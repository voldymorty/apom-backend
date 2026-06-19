const Sequelize = require("sequelize");
const Op = Sequelize.Op;
const db = require("../../models");

const {
  PickupDelivery,
  DeliveryStatusHistory,
  DeliveryRoute,
  DeliveryPersonnel,
  Farmer,
  FarmerCrop,
  Vendor,
  Order,
  OrderItem,
  Inventory,
  InventoryTransaction,
  FarmerEarning,
  User,
  Product,
} = db;

// ─────────────────────────────────────────────
// Helper: generate delivery_number
// PKP-YYYYMMDD-XXXX for pickup
// DEL-YYYYMMDD-XXXX for delivery
// ─────────────────────────────────────────────
const generateDeliveryNumber = async (delivery_type) => {
  const prefix = delivery_type === "pickup" ? "PKP" : "DEL";
  const today = new Date();
  const datePart = today.toISOString().slice(0, 10).replace(/-/g, "");

  // Count existing records of this type today
  const startOfDay = new Date(today.setHours(0, 0, 0, 0));
  const endOfDay = new Date(today.setHours(23, 59, 59, 999));

  const count = await PickupDelivery.count({
    where: {
      delivery_type,
      created_at: { [Op.between]: [startOfDay, endOfDay] },
    },
  });

  const sequence = String(count + 1).padStart(4, "0");
  return `${prefix}-${datePart}-${sequence}`;
};

// ─────────────────────────────────────────────
// Helper: log status history
// ─────────────────────────────────────────────
const logStatusHistory = async (delivery_id, old_status, new_status, user_id, remarks = null, transaction = null) => {
  await DeliveryStatusHistory.create(
    {
      delivery_id,
      old_status,
      new_status,
      changed_by: user_id,
      remarks,
    },
    transaction ? { transaction } : {}
  );
};

// ═══════════════════════════════════════════════════════════════
// PICKUPS & DELIVERIES
// ═══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────
// POST /admin/pickups-deliveries
// Create a new pickup or delivery task
// ─────────────────────────────────────────────
exports.createPickupDelivery = async (req, res) => {
  try {
    const {
      delivery_type,
      // Pickup fields
      farmer_id,
      crop_id,
      pickup_address,
      pickup_contact_name,
      pickup_contact_number,
      // Delivery fields
      order_id,
      vendor_id,
      delivery_address,
      delivery_contact_name,
      delivery_contact_number,
      delivery_latitude,
      delivery_longitude,
      // Common fields
      delivery_person_id,
      scheduled_date,
      scheduled_time_slot,
      expected_quantity_kg,
      delivery_notes,
    } = req.body;

    // ── Validate delivery_type ──
    if (!delivery_type || !["pickup", "delivery"].includes(delivery_type)) {
      return res.status(400).json({
        success: false,
        message: "delivery_type is required and must be pickup or delivery",
      });
    }

    // ── Conditional validation ──
    if (delivery_type === "pickup") {
      if (!farmer_id || !crop_id || !pickup_address) {
        return res.status(400).json({
          success: false,
          message: "farmer_id, crop_id and pickup_address are required for pickup tasks",
        });
      }
    }

    if (delivery_type === "delivery") {
      if (!order_id || !vendor_id || !delivery_address) {
        return res.status(400).json({
          success: false,
          message: "order_id, vendor_id and delivery_address are required for delivery tasks",
        });
      }
    }

    // ── Validate delivery_person_id if provided ──
    if (delivery_person_id) {
      const person = await DeliveryPersonnel.findByPk(delivery_person_id);
      if (!person) {
        return res.status(404).json({ success: false, message: "Delivery personnel not found" });
      }
    }

    // ── Validate farmer + crop if pickup ──
    if (delivery_type === "pickup") {
      const farmer = await Farmer.findByPk(farmer_id);
      if (!farmer) {
        return res.status(404).json({ success: false, message: "Farmer not found" });
      }

      const crop = await FarmerCrop.findOne({ where: { crop_id, farmer_id } });
      if (!crop) {
        return res.status(404).json({ success: false, message: "Crop not found for this farmer" });
      }

      if (crop.status !== "available") {
        return res.status(409).json({
          success: false,
          message: `Crop is not available for pickup. Current status: ${crop.status}`,
        });
      }
    }

    // ── Validate order + vendor if delivery ──
    if (delivery_type === "delivery") {
      const order = await Order.findByPk(order_id);
      if (!order) {
        return res.status(404).json({ success: false, message: "Order not found" });
      }

      const vendor = await Vendor.findByPk(vendor_id);
      if (!vendor) {
        return res.status(404).json({ success: false, message: "Vendor not found" });
      }
    }

    const t = await db.sequelize.transaction();

    try {
      const delivery_number = await generateDeliveryNumber(delivery_type);

      const newTask = await PickupDelivery.create(
        {
          delivery_number,
          delivery_type,
          farmer_id: delivery_type === "pickup" ? farmer_id : null,
          crop_id: delivery_type === "pickup" ? crop_id : null,
          order_id: delivery_type === "delivery" ? order_id : null,
          vendor_id: delivery_type === "delivery" ? vendor_id : null,
          delivery_person_id: delivery_person_id || null,
          assigned_by: delivery_person_id ? req.user.user_id : null,
          pickup_address: delivery_type === "pickup" ? pickup_address : null,
          pickup_contact_name: pickup_contact_name || null,
          pickup_contact_number: pickup_contact_number || null,
          delivery_address: delivery_type === "delivery" ? delivery_address : null,
          delivery_contact_name: delivery_contact_name || null,
          delivery_contact_number: delivery_contact_number || null,
          delivery_latitude: delivery_latitude || null,
          delivery_longitude: delivery_longitude || null,
          scheduled_date: scheduled_date || null,
          scheduled_time_slot: scheduled_time_slot || null,
          expected_quantity_kg: expected_quantity_kg || null,
          delivery_notes: delivery_notes || null,
          status: "assigned",
        },
        { transaction: t }
      );

      // Update crop status → pickup_assigned
      if (delivery_type === "pickup") {
        await FarmerCrop.update(
          { status: "pickup_assigned" },
          { where: { crop_id }, transaction: t }
        );
      }

      // Log initial status
      await logStatusHistory(
        newTask.delivery_id,
        null,
        "assigned",
        req.user.user_id,
        `${delivery_type === "pickup" ? "Pickup" : "Delivery"} task created by admin`,
        t
      );

      await t.commit();

      // Trigger automatic notifications asynchronously in the background
      (async () => {
        try {
          const { sendNotification } = require("../../utils/notificationService");

          // 1. Notify Delivery Personnel if assigned on creation
          if (newTask.delivery_person_id) {
            const dp = await DeliveryPersonnel.findByPk(newTask.delivery_person_id);
            if (dp && dp.user_id) {
              await sendNotification({
                userId: dp.user_id,
                type: "delivery",
                title: "🚚 New Task Assigned",
                message: `You have been assigned a new ${newTask.delivery_type} task: ${newTask.delivery_number}`,
                referenceType: "delivery",
                referenceId: newTask.delivery_id,
                priority: "high",
                fcmData: {
                  screen: newTask.delivery_type === "delivery" ? "delivery_detail" : "pickup_detail",
                  task_id: String(newTask.delivery_id),
                },
              });
            }
          }

          // 2. Notify Farmer if it's a pickup
          if (newTask.delivery_type === "pickup" && newTask.farmer_id) {
            const farmer = await Farmer.findByPk(newTask.farmer_id);
            if (farmer && farmer.user_id) {
              await sendNotification({
                userId: farmer.user_id,
                type: "order",
                title: "📅 Pickup Scheduled",
                message: `Your crop pickup has been scheduled. Task: ${newTask.delivery_number}`,
                referenceType: "crop",
                referenceId: newTask.crop_id,
                priority: "medium",
                fcmData: {
                  screen: "pickup",
                  crop_id: String(newTask.crop_id),
                },
              });
            }
          }

          // 3. Notify Vendor if it's a delivery
          if (newTask.delivery_type === "delivery" && newTask.vendor_id) {
            const vendor = await Vendor.findByPk(newTask.vendor_id);
            if (vendor && vendor.user_id) {
              await sendNotification({
                userId: vendor.user_id,
                type: "order",
                title: "🚚 Delivery Scheduled",
                message: `Your order delivery has been scheduled. Task: ${newTask.delivery_number}`,
                referenceType: "order",
                referenceId: newTask.order_id,
                priority: "medium",
                fcmData: {
                  screen: "order_detail",
                  order_id: String(newTask.order_id),
                },
              });
            }
          }
        } catch (notificationErr) {
          console.error("🔔 Error sending automatic task creation notifications:", notificationErr);
        }
      })();

      return res.status(201).json({
        success: true,
        message: `${delivery_type === "pickup" ? "Pickup" : "Delivery"} task created successfully`,
        data: {
          delivery_id: newTask.delivery_id,
          delivery_number: newTask.delivery_number,
          delivery_type: newTask.delivery_type,
          status: newTask.status,
          created_at: newTask.created_at,
        },
      });
    } catch (innerError) {
      await t.rollback();
      throw innerError;
    }
  } catch (error) {
    console.error("createPickupDelivery error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─────────────────────────────────────────────
// GET /admin/pickups-deliveries
// List all with filters & pagination
// ─────────────────────────────────────────────
exports.listPickupDeliveries = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      delivery_type,
      status,
      delivery_person_id,
      farmer_id,
      vendor_id,
      from_date,
      to_date,
      unassigned,
      procurement_status,
      search,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    const where = {};
    if (delivery_type) where.delivery_type = delivery_type;
    if (status) where.status = status;

    if (unassigned === "true") {
      where.delivery_person_id = null;
    } else if (delivery_person_id) {
      where.delivery_person_id = parseInt(delivery_person_id);
    }

    if (farmer_id) where.farmer_id = parseInt(farmer_id);
    if (vendor_id) where.vendor_id = parseInt(vendor_id);

    if (from_date || to_date) {
      where.scheduled_date = {};
      if (from_date) where.scheduled_date[Op.gte] = new Date(from_date);
      if (to_date) where.scheduled_date[Op.lte] = new Date(to_date);
    }

    if (procurement_status) {
      where.procurement_status = procurement_status;
    }

    if (search) {
      where[Op.or] = [
        // Common
        { delivery_number: { [Op.like]: `%${search}%` } },

        // Pickup
        { "$farmer.full_name$": { [Op.like]: `%${search}%` } },
        { "$crop.product.product_name$": { [Op.like]: `%${search}%` } },
        { "$delivery_person.full_name$": { [Op.like]: `%${search}%` } },
        { pickup_address: { [Op.like]: `%${search}%` } },

        // Delivery
        { "$order.order_number$": { [Op.like]: `%${search}%` } },
        { "$vendor.shop_name$": { [Op.like]: `%${search}%` } },
        { "$vendor.owner_name$": { [Op.like]: `%${search}%` } },
        { delivery_address: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows } = await PickupDelivery.findAndCountAll({
      where,
      include: [
        {
          model: DeliveryPersonnel,
          as: "delivery_person",
          attributes: ["delivery_person_id", "full_name", "vehicle_type", "vehicle_number"],
          required: false,
        },
        {
          model: Farmer,
          as: "farmer",
          attributes: ["farmer_id", "full_name"],
          required: false,
        },
        {
          model: Vendor,
          as: "vendor",
          attributes: ["vendor_id", "shop_name", "owner_name"],
          required: false,
        },
        {
          model: Order,
          as: "order",
          attributes: ["order_id", "order_number", "final_amount", "order_status"],
          required: false,
        },
        {
          model: FarmerCrop,
          as: "crop",
          attributes: ["crop_id", "grade", "quantity_kg", "expected_price_per_kg", "status", "crop_photo_url"],
          required: false,
          include: [
            {
              model: Product,
              as: "product",
              attributes: ["product_id", "product_name", "unit", "image_url"],
              required: false,
            },
          ],
        },
      ],
      order: [["created_at", "DESC"]],
      limit: limitNum,
      offset,
      distinct: true,
    });

    const totalPages = Math.ceil(count / limitNum);

    return res.status(200).json({
      success: true,
      message: "Pickup/delivery tasks fetched successfully",
      data: {
        tasks: rows.map((d) => ({
          delivery_id: d.delivery_id,
          delivery_number: d.delivery_number,
          delivery_type: d.delivery_type,
          status: d.status,
          scheduled_date: d.scheduled_date,
          scheduled_time_slot: d.scheduled_time_slot,
          expected_quantity_kg: d.expected_quantity_kg,
          actual_quantity_kg: d.actual_quantity_kg,
          procurement_amount: d.procurement_amount,
          procurement_status: d.procurement_status,
          final_procurement_amount: d.final_procurement_amount,
          pickup_address: d.pickup_address,
          delivery_address: d.delivery_address,
          delivery_person: d.delivery_person,
          farmer: d.farmer,
          vendor: d.vendor,
          order: d.order,
          crop: d.crop,
          created_at: d.created_at,
        })),
        pagination: {
          total: count,
          page: pageNum,
          limit: limitNum,
          total_pages: totalPages,
        },
      },
    });
  } catch (error) {
    console.error("listPickupDeliveries error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─────────────────────────────────────────────
// GET /admin/pickups-deliveries/:delivery_id
// Full record + status history
// ─────────────────────────────────────────────
exports.getPickupDeliveryById = async (req, res) => {
  try {
    const { delivery_id } = req.params;

    const task = await PickupDelivery.findByPk(delivery_id, {
      include: [
        {
          model: DeliveryPersonnel,
          as: "delivery_person",
          attributes: ["delivery_person_id", "full_name", "vehicle_type", "vehicle_number", "rating"],
          include: [
            { model: User, as: "user", attributes: ["mobile_number"] },
          ],
        },
        {
          model: Farmer,
          as: "farmer",
          attributes: ["farmer_id", "full_name", "location_address"],
          include: [
            { model: User, as: "user", attributes: ["mobile_number"] },
          ],
          required: false,
        },
        {
          model: FarmerCrop,
          as: "crop",
          attributes: [
            "crop_id",
            "product_id",
            "grade",
            "quantity_kg",
            "expected_price_per_kg",
            "status",
          ],
          required: false,
          include: [
            {
              model: Product,
              as: "product",
              attributes: ["product_id", "product_name", "unit"],
              required: false,
            },
          ],
        },
        {
          model: Vendor,
          as: "vendor",
          attributes: ["vendor_id", "shop_name", "owner_name"],
          include: [
            { model: User, as: "user", attributes: ["mobile_number"] },
          ],
          required: false,
        },
        {
          model: Order,
          as: "order",
          attributes: ["order_id", "order_number", "final_amount", "order_status"],
          required: false,
        },
        {
          model: DeliveryStatusHistory,
          as: "status_history",
          include: [
            {
              model: User,
              as: "changed_user",
              attributes: ["user_id", "mobile_number"],
              required: false,
            },
          ],
          order: [["created_at", "ASC"]],
        },
      ],
    });

    if (!task) {
      return res.status(404).json({ success: false, message: "Pickup/delivery task not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Pickup/delivery task fetched successfully",
      data: task,
    });
  } catch (error) {
    console.error("getPickupDeliveryById error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─────────────────────────────────────────────
// PATCH /admin/pickups-deliveries/:delivery_id/assign
// Assign or reassign delivery person
// ─────────────────────────────────────────────
exports.assignDeliveryPersonnel = async (req, res) => {
  const t = await db.sequelize.transaction();
  try {
    const { delivery_id } = req.params;
    const { delivery_person_id, scheduled_date, scheduled_time_slot } = req.body;

    if (!delivery_person_id) {
      await t.rollback();
      return res.status(400).json({ success: false, message: "delivery_person_id is required" });
    }

    const task = await PickupDelivery.findByPk(delivery_id, { transaction: t });
    if (!task) {
      await t.rollback();
      return res.status(404).json({ success: false, message: "Pickup/delivery task not found" });
    }

    if (["completed", "cancelled"].includes(task.status)) {
      await t.rollback();
      return res.status(409).json({
        success: false,
        message: `Cannot assign personnel to a ${task.status} task`,
      });
    }

    const person = await DeliveryPersonnel.findByPk(delivery_person_id, { transaction: t });
    if (!person) {
      await t.rollback();
      return res.status(404).json({ success: false, message: "Delivery personnel not found" });
    }

    const isReassign = task.delivery_person_id !== null;
    const oldStatus = task.status;

    const updates = {
      delivery_person_id,
      assigned_by: req.user.user_id,
      // Reset to assigned if being reassigned so new person must accept
      status: "assigned",
    };
    if (scheduled_date) updates.scheduled_date = scheduled_date;
    if (scheduled_time_slot) updates.scheduled_time_slot = scheduled_time_slot;

    await PickupDelivery.update(updates, { where: { delivery_id }, transaction: t });

    // Link crop status sync: when assigning a driver for a pickup request, mark it pickup_assigned
    if (task.delivery_type === "pickup" && task.crop_id) {
      await FarmerCrop.update(
        { status: "pickup_assigned" },
        { where: { crop_id: task.crop_id }, transaction: t }
      );
    }

    // Log status reset if it was previously accepted/in_transit
    if (isReassign && oldStatus !== "assigned") {
      await logStatusHistory(
        delivery_id,
        oldStatus,
        "assigned",
        req.user.user_id,
        `Reassigned to delivery person ID ${delivery_person_id} — status reset to assigned`,
        t
      );
    }

    await t.commit();

    // Trigger automatic notifications asynchronously in the background
    (async () => {
      try {
        const { sendNotification } = require("../../utils/notificationService");

        // 1. Notify Delivery Personnel of the assignment
        const dp = await DeliveryPersonnel.findByPk(delivery_person_id);
        if (dp && dp.user_id) {
          await sendNotification({
            userId: dp.user_id,
            type: "delivery",
            title: isReassign ? "🔄 Task Reassigned" : "🚚 New Task Assigned",
            message: `You have been assigned a ${task.delivery_type} task: ${task.delivery_number}`,
            referenceType: "delivery",
            referenceId: task.delivery_id,
            priority: "high",
            fcmData: {
              screen: task.delivery_type === "delivery" ? "delivery_detail" : "pickup_detail",
              task_id: String(task.delivery_id),
            },
          });
        }

        // 2. Notify Farmer or Vendor about driver assignment
        if (task.delivery_type === "pickup" && task.farmer_id) {
          const farmer = await Farmer.findByPk(task.farmer_id);
          if (farmer && farmer.user_id) {
            await sendNotification({
              userId: farmer.user_id,
              type: "order",
              title: "📅 Pickup Driver Assigned",
              message: `Driver ${dp ? dp.full_name : "partner"} has been assigned to pick up your crop. Task: ${task.delivery_number}`,
              referenceType: "crop",
              referenceId: task.crop_id,
              priority: "medium",
              fcmData: {
                screen: "pickup",
                crop_id: String(task.crop_id),
              },
            });
          }
        } else if (task.delivery_type === "delivery" && task.vendor_id) {
          const vendor = await Vendor.findByPk(task.vendor_id);
          if (vendor && vendor.user_id) {
            await sendNotification({
              userId: vendor.user_id,
              type: "order",
              title: "🚚 Delivery Driver Assigned",
              message: `Driver ${dp ? dp.full_name : "partner"} has been assigned to deliver your order. Task: ${task.delivery_number}`,
              referenceType: "order",
              referenceId: task.order_id,
              priority: "medium",
              fcmData: {
                screen: "order_detail",
                order_id: String(task.order_id),
              },
            });
          }
        }
      } catch (notificationErr) {
        console.error("🔔 Error sending automatic task assignment notifications:", notificationErr);
      }
    })();

    return res.status(200).json({
      success: true,
      message: isReassign
        ? "Delivery personnel reassigned successfully"
        : "Delivery personnel assigned successfully",
    });
  } catch (error) {
    await t.rollback();
    console.error("assignDeliveryPersonnel error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─────────────────────────────────────────────
// PATCH /admin/pickups-deliveries/:delivery_id/status
// Manually update status + log history
// ─────────────────────────────────────────────
exports.updatePickupDeliveryStatus = async (req, res) => {
  try {
    const { delivery_id } = req.params;
    const { status, remarks } = req.body;

    const allowedStatuses = ["assigned", "accepted", "in_transit", "reached", "completed", "failed"];

    if (!status) {
      return res.status(400).json({ success: false, message: "status is required" });
    }

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `status must be one of: ${allowedStatuses.join(", ")}`,
      });
    }

    const task = await PickupDelivery.findByPk(delivery_id);
    if (!task) {
      return res.status(404).json({ success: false, message: "Pickup/delivery task not found" });
    }

    if (task.status === "cancelled") {
      return res.status(409).json({ success: false, message: "Cannot update status of a cancelled task" });
    }

    // ── Status transition validation (admin can override but not backwards) ──
    const allowedTransitions = {
      assigned:   ["accepted", "in_transit", "reached", "completed", "failed"],
      accepted:   ["in_transit", "reached", "completed", "failed"],
      in_transit: ["reached", "completed", "failed"],
      reached:    ["completed", "failed"],
      completed:  [],
      failed:     [],
    };
    const allowed = allowedTransitions[task.status] || [];
    if (!allowed.includes(status)) {
      return res.status(409).json({
        success: false,
        message: `Cannot transition from '${task.status}' to '${status}'. Allowed: [${allowed.join(", ") || "none"}]`,
      });
    }


    const oldStatus = task.status;

    // Build timestamp updates based on status transition
    const updates = { status };
    if (status === "accepted") updates.accepted_at = new Date();
    if (status === "in_transit") updates.started_at = new Date();
    if (status === "reached") updates.reached_at = new Date();
    if (status === "completed") updates.completed_at = new Date();

    const t = await db.sequelize.transaction();

    try {
      await PickupDelivery.update(updates, { where: { delivery_id }, transaction: t });

      // If pickup completed → update crop status to picked_up
      // Inventory stock_in is handled MANUALLY by admin via inventory management
      if (status === "completed" && task.delivery_type === "pickup" && task.crop_id) {
        await FarmerCrop.update(
          { status: "picked_up" },
          { where: { crop_id: task.crop_id }, transaction: t }
        );
      }

      // If delivery completed → deduct reserved inventory + mark order delivered
      if (status === "completed" && task.delivery_type === "delivery" && task.order_id) {
        const orderItems = await OrderItem.findAll({
          where: {
            order_id: task.order_id,
            status: { [Op.ne]: "cancelled" },
          },
          transaction: t,
        });

        for (const item of orderItems) {
          const inventory = await Inventory.findOne({
            where: { product_id: item.product_id, grade: item.grade },
            transaction: t,
            lock: t.LOCK.UPDATE,
          });

          if (inventory) {
            const deductQty = parseFloat(item.quantity_kg);
            const currentReserved = parseFloat(inventory.reserved_quantity_kg);
            const newReserved = Math.max(0, currentReserved - deductQty);

            await Inventory.update(
              { reserved_quantity_kg: newReserved },
              { where: { inventory_id: inventory.inventory_id }, transaction: t }
            );

            await InventoryTransaction.create(
              {
                inventory_id: inventory.inventory_id,
                transaction_type: "stock_out",
                quantity_kg: deductQty,
                reference_type: "order",
                reference_id: task.order_id,
                previous_quantity: currentReserved,
                new_quantity: newReserved,
                performed_by: req.user.user_id,
                remarks: `Stock out — delivery ${task.delivery_number} completed`,
              },
              { transaction: t }
            );
          }

          // Mark each order item as delivered
          await OrderItem.update(
            { status: "delivered", delivered_quantity_kg: item.quantity_kg },
            { where: { order_item_id: item.order_item_id }, transaction: t }
          );
        }

        // Mark the parent order as delivered
        await Order.update(
          { order_status: "delivered", actual_delivery_date: new Date() },
          { where: { order_id: task.order_id }, transaction: t }
        );
      } else if (task.delivery_type === "delivery" && task.order_id) {
        let order_status = null;
        if (status === "accepted") order_status = "processing";
        else if (status === "in_transit") order_status = "dispatched";
        else if (status === "cancelled") order_status = "confirmed";

        if (order_status) {
          await Order.update(
            { order_status },
            { where: { order_id: task.order_id }, transaction: t }
          );
        }
      }

      await logStatusHistory(delivery_id, oldStatus, status, req.user.user_id, remarks || null, t);

      await t.commit();

      // Trigger automatic status change notifications asynchronously in the background
      const { notifyStatusChange } = require("../../utils/notificationService");
      notifyStatusChange(task, status).catch((err) =>
        console.error("🔔 Error calling notifyStatusChange:", err)
      );

      return res.status(200).json({
        success: true,
        message: "Status updated successfully",
      });
    } catch (innerError) {
      await t.rollback();
      throw innerError;
    }
  } catch (error) {
    console.error("updatePickupDeliveryStatus error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─────────────────────────────────────────────
// PATCH /admin/pickups-deliveries/:delivery_id/finalize-procurement
// Admin inspects procured product, removes wastage, fixes final amount,
// then adds accepted quantity to inventory.
// ─────────────────────────────────────────────
exports.finalizeProcurement = async (req, res) => {
  const t = await db.sequelize.transaction();
  try {
    const { delivery_id } = req.params;
    const {
      wastage_quantity_kg,
      accepted_quantity_kg,
      final_procurement_amount,
      procurement_remarks,
      final_grade,

      payment_status,
      payment_date,
      payment_method,
      transaction_id,
      transaction_reference,
    } = req.body;

    const task = await PickupDelivery.findByPk(delivery_id, {
      include: [
        {
          model: FarmerCrop,
          as: "crop",
          include: [{ model: Product, as: "product" }],
        },
      ],
      transaction: t,
    });

    if (!task) {
      await t.rollback();
      return res.status(404).json({ success: false, message: "Pickup/delivery task not found" });
    }

    if (task.delivery_type !== "pickup") {
      await t.rollback();
      return res.status(400).json({ success: false, message: "Procurement finalization applies only to pickup tasks" });
    }

    if (task.status !== "completed") {
      await t.rollback();
      return res.status(409).json({
        success: false,
        message: "Pickup must be completed before procurement can be finalized",
      });
    }

    if (task.procurement_status === "finalized") {
      await t.rollback();
      return res.status(409).json({ success: false, message: "Procurement is already finalized" });
    }

    if (task.procurement_status !== "pending_review") {
      await t.rollback();
      return res.status(409).json({
        success: false,
        message: "No procurement data submitted by delivery person yet",
      });
    }

    const procuredQty = parseFloat(task.actual_quantity_kg || 0);
    if (procuredQty <= 0) {
      await t.rollback();
      return res.status(400).json({ success: false, message: "Procured quantity is missing on this pickup" });
    }

    const wastage = parseFloat(wastage_quantity_kg || 0);
    if (isNaN(wastage) || wastage < 0) {
      await t.rollback();
      return res.status(400).json({ success: false, message: "wastage_quantity_kg must be zero or greater" });
    }

    if (wastage > procuredQty) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Wastage cannot exceed procured quantity",
      });
    }

    let acceptedQty =
      accepted_quantity_kg !== undefined && accepted_quantity_kg !== null
        ? parseFloat(accepted_quantity_kg)
        : procuredQty - wastage;

    if (isNaN(acceptedQty) || acceptedQty <= 0) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "accepted_quantity_kg must be greater than 0 after wastage removal",
      });
    }

    if (acceptedQty > procuredQty - wastage + 0.001) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Accepted quantity cannot exceed procured quantity minus wastage",
      });
    }

    const finalAmount = parseFloat(final_procurement_amount);
    if (!final_procurement_amount || isNaN(finalAmount) || finalAmount <= 0) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "final_procurement_amount is required and must be greater than 0",
      });
    }

    if (!task.crop || !task.crop.product_id) {
      await t.rollback();
      return res.status(400).json({ success: false, message: "Linked crop/product not found for this pickup" });
    }

    const validStatuses = ["pending", "processing", "paid", "failed"];

    if (
      payment_status &&
      !validStatuses.includes(payment_status)
    ) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Invalid payment_status",
      });
    }

    const validMethods = [
      "bank_transfer",
      "upi",
      "cash",
      "cheque",
    ];

    if (
      payment_method &&
      !validMethods.includes(payment_method)
    ) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "Invalid payment_method",
      });
    }

    const originalGrade = task.crop.grade;
    const grade = final_grade || originalGrade;
    const productId = task.crop.product_id;
    const now = new Date();

    await PickupDelivery.update(
      {
        wastage_quantity_kg: wastage,
        accepted_quantity_kg: acceptedQty,
        final_procurement_amount: finalAmount,
        procurement_remarks: procurement_remarks || null,
        procurement_status: "finalized",
        finalized_at: now,
        finalized_by: req.user.user_id,
      },
      { where: { delivery_id }, transaction: t }
    );

    await FarmerCrop.update(
      {
        status: "picked_up",
        grade,
      },
      {
        where: { crop_id: task.crop_id },
        transaction: t,
      }
    );

    let inventory = await Inventory.findOne({
      where: { product_id: productId, grade },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    const previousQty = inventory
      ? parseFloat(inventory.available_quantity_kg)
      : 0;
    const newQty = previousQty + acceptedQty;

    if (!inventory) {
      inventory = await Inventory.create(
        {
          product_id: productId,
          grade,
          available_quantity_kg: acceptedQty,
          reserved_quantity_kg: 0,
          last_restocked_at: now,
        },
        { transaction: t }
      );
    } else {
      await Inventory.update(
        {
          available_quantity_kg: newQty,
          last_restocked_at: now,
        },
        { where: { inventory_id: inventory.inventory_id }, transaction: t }
      );
    }

    await InventoryTransaction.create(
      {
        inventory_id: inventory.inventory_id,
        transaction_type: "stock_in",
        quantity_kg: acceptedQty,
        reference_type: "pickup",
        reference_id: task.delivery_id,
        previous_quantity: previousQty,
        new_quantity: newQty,
        performed_by: req.user.user_id,
        remarks:
          procurement_remarks ||
          `Procurement finalized — Grade ${grade}, ${acceptedQty} kg accepted after ${wastage} kg wastage`,
      },
      { transaction: t }
    );

    const pricePerKg = parseFloat((finalAmount / acceptedQty).toFixed(2));
    await FarmerEarning.create(
      {
        farmer_id: task.farmer_id,
        crop_id: task.crop_id,
        pickup_delivery_id: task.delivery_id,
        quantity_supplied_kg: acceptedQty,
        price_per_kg: pricePerKg,
        total_amount: finalAmount,
        net_amount: finalAmount,
        payment_status: payment_status || "pending",
        payment_date: payment_date || null,
        payment_method: payment_method || null,
        transaction_id: transaction_id || null,
        transaction_reference: transaction_reference || null,
        remarks:
          procurement_remarks ||
          `Procurement finalized for pickup ${task.delivery_number}. Payment handled outside app.`,
      },
      { transaction: t }
    );

    await Farmer.increment(
      { total_earnings: finalAmount },
      {
        where: { farmer_id: task.farmer_id },
        transaction: t,
      }
    );

    await logStatusHistory(
      delivery_id,
      task.status,
      task.status,
      req.user.user_id,
      `Procurement finalized — ${acceptedQty} kg to inventory, final amount Rs.${finalAmount}`,
      t
    );

    await t.commit();

    // Trigger notification to farmer asynchronously
    (async () => {
      try {
        const { sendNotification } = require("../../utils/notificationService");
        if (task.farmer_id) {
          const farmer = await Farmer.findByPk(task.farmer_id);
          if (farmer && farmer.user_id) {
            await sendNotification({
              userId: farmer.user_id,
              type: "order",
              title: "🎉 Procurement Finalized",
              message: `Your crop procurement has been finalized. Final Quantity: ${acceptedQty} kg. Amount: ₹${finalAmount}.`,
              referenceType: "crop",
              referenceId: task.crop_id,
              priority: "high",
              fcmData: {
                screen: "pickup",
                crop_id: String(task.crop_id),
              },
            });
          }
        }
      } catch (err) {
        console.error("🔔 Error sending procurement finalized notification:", err);
      }
    })();

    return res.status(200).json({
      success: true,
      message: "Procurement finalized and stock added to inventory",
      data: {
        delivery_id: parseInt(delivery_id),
        accepted_quantity_kg: acceptedQty,
        wastage_quantity_kg: wastage,
        final_procurement_amount: finalAmount,
        procurement_status: "finalized",
      },
    });
  } catch (error) {
    await t.rollback();
    console.error("finalizeProcurement error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─────────────────────────────────────────────
// PATCH /admin/pickups-deliveries/:delivery_id/cancel
// Cancel a task
// ─────────────────────────────────────────────
exports.cancelPickupDelivery = async (req, res) => {
  try {
    const { delivery_id } = req.params;
    const { failure_reason } = req.body;

    if (!failure_reason) {
      return res.status(400).json({ success: false, message: "failure_reason is required" });
    }

    const task = await PickupDelivery.findByPk(delivery_id);
    if (!task) {
      return res.status(404).json({ success: false, message: "Pickup/delivery task not found" });
    }

    if (task.status === "cancelled") {
      return res.status(409).json({ success: false, message: "Task is already cancelled" });
    }

    if (task.status === "completed") {
      return res.status(409).json({ success: false, message: "Cannot cancel a completed task" });
    }

    const oldStatus = task.status;
    const t = await db.sequelize.transaction();

    try {
      await PickupDelivery.update(
        { status: "cancelled", failure_reason },
        { where: { delivery_id }, transaction: t }
      );

      // Revert crop status back to available if pickup was cancelled
      if (task.delivery_type === "pickup" && task.crop_id) {
        await FarmerCrop.update(
          { status: "available" },
          { where: { crop_id: task.crop_id }, transaction: t }
        );
      }

      await logStatusHistory(
        delivery_id,
        oldStatus,
        "cancelled",
        req.user.user_id,
        failure_reason,
        t
      );

      await t.commit();

      // Trigger automatic status change notifications asynchronously in the background
      const { notifyStatusChange } = require("../../utils/notificationService");
      notifyStatusChange(task, "cancelled").catch((err) =>
        console.error("🔔 Error calling notifyStatusChange:", err)
      );

      return res.status(200).json({
        success: true,
        message: "Task cancelled successfully",
      });
    } catch (innerError) {
      await t.rollback();
      throw innerError;
    }
  } catch (error) {
    console.error("cancelPickupDelivery error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─────────────────────────────────────────────
// GET /admin/pickups-deliveries/:delivery_id/history
// Status change history
// ─────────────────────────────────────────────
exports.getStatusHistory = async (req, res) => {
  try {
    const { delivery_id } = req.params;

    const task = await PickupDelivery.findByPk(delivery_id);
    if (!task) {
      return res.status(404).json({ success: false, message: "Pickup/delivery task not found" });
    }

    const history = await DeliveryStatusHistory.findAll({
      where: { delivery_id },
      include: [
        {
          model: User,
          as: "changed_user",
          attributes: ["user_id", "mobile_number"],
          required: false,
        },
      ],
      order: [["created_at", "ASC"]],
    });

    return res.status(200).json({
      success: true,
      message: "Status history fetched successfully",
      data: { history },
    });
  } catch (error) {
    console.error("getStatusHistory error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ═══════════════════════════════════════════════════════════════
// DELIVERY ROUTES
// ═══════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────
// GET /admin/routes
// List delivery routes with filters
// ─────────────────────────────────────────────
exports.listRoutes = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      delivery_person_id,
      from_date,
      to_date,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    const where = {};
    if (status) where.status = status;
    if (delivery_person_id) where.delivery_person_id = parseInt(delivery_person_id);

    if (from_date || to_date) {
      where.route_date = {};
      if (from_date) where.route_date[Op.gte] = new Date(from_date);
      if (to_date) where.route_date[Op.lte] = new Date(to_date);
    }

    const { count, rows } = await DeliveryRoute.findAndCountAll({
      where,
      include: [
        {
          model: DeliveryPersonnel,
          as: "delivery_person",
          attributes: ["delivery_person_id", "full_name", "vehicle_type", "vehicle_number"],
          required: false,
        },
      ],
      order: [["route_date", "DESC"]],
      limit: limitNum,
      offset,
      distinct: true,
    });

    const totalPages = Math.ceil(count / limitNum);

    return res.status(200).json({
      success: true,
      message: "Routes fetched successfully",
      data: {
        routes: rows,
        pagination: {
          total: count,
          page: pageNum,
          limit: limitNum,
          total_pages: totalPages,
        },
      },
    });
  } catch (error) {
    console.error("listRoutes error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─────────────────────────────────────────────
// POST /admin/routes
// Create a delivery route
// ─────────────────────────────────────────────
exports.createRoute = async (req, res) => {
  try {
    const {
      route_name,
      delivery_person_id,
      route_date,
      total_distance_km,
      estimated_time_hours,
      optimized_waypoints,
    } = req.body;

    if (!route_name || !route_date) {
      return res.status(400).json({
        success: false,
        message: "route_name and route_date are required",
      });
    }

    if (delivery_person_id) {
      const person = await DeliveryPersonnel.findByPk(delivery_person_id);
      if (!person) {
        return res.status(404).json({ success: false, message: "Delivery personnel not found" });
      }
    }

    const newRoute = await DeliveryRoute.create({
      route_name,
      delivery_person_id: delivery_person_id || null,
      route_date,
      total_distance_km: total_distance_km || null,
      estimated_time_hours: estimated_time_hours || null,
      optimized_waypoints: optimized_waypoints || null,
      status: "planned",
      created_by: req.user.user_id,
      total_stops: 0,
      completed_stops: 0,
    });

    return res.status(201).json({
      success: true,
      message: "Route created successfully",
      data: {
        route_id: newRoute.route_id,
        route_name: newRoute.route_name,
        route_date: newRoute.route_date,
        status: newRoute.status,
        created_at: newRoute.created_at,
      },
    });
  } catch (error) {
    console.error("createRoute error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─────────────────────────────────────────────
// GET /admin/routes/:route_id
// Route detail with all stops (farmer/vendor info on each)
// ─────────────────────────────────────────────
exports.getRouteById = async (req, res) => {
  try {
    const { route_id } = req.params;

    const route = await DeliveryRoute.findByPk(route_id, {
      include: [
        {
          model: DeliveryPersonnel,
          as: "delivery_person",
          attributes: ["delivery_person_id", "full_name", "vehicle_type", "vehicle_number", "rating"],
          include: [
            { model: User, as: "user", attributes: ["mobile_number"] },
          ],
          required: false,
        },
        {
          model: PickupDelivery,
          as: "deliveries",
          attributes: [
            "delivery_id", "delivery_number", "delivery_type", "status",
            "pickup_address", "delivery_address",
            "pickup_contact_name", "pickup_contact_number",
            "delivery_contact_name", "delivery_contact_number",
            "scheduled_date", "scheduled_time_slot",
            "expected_quantity_kg", "actual_quantity_kg",
          ],
          include: [
            {
              model: Farmer,
              as: "farmer",
              attributes: ["farmer_id", "full_name", "location_address"],
              include: [
                { model: User, as: "user", attributes: ["mobile_number"] },
              ],
              required: false,
            },
            {
              model: Vendor,
              as: "vendor",
              attributes: ["vendor_id", "shop_name", "owner_name"],
              include: [
                { model: User, as: "user", attributes: ["mobile_number"] },
              ],
              required: false,
            },
            {
              model: FarmerCrop,
              as: "crop",
              attributes: ["crop_id", "grade", "quantity_kg", "status"],
              required: false,
            },
            {
              model: Order,
              as: "order",
              attributes: ["order_id", "order_number", "final_amount"],
              required: false,
            },
          ],
          required: false,
        },
      ],
    });

    if (!route) {
      return res.status(404).json({ success: false, message: "Route not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Route fetched successfully",
      data: route,
    });
  } catch (error) {
    console.error("getRouteById error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─────────────────────────────────────────────
// PATCH /admin/routes/:route_id
// Update route details
// ─────────────────────────────────────────────
exports.updateRoute = async (req, res) => {
  try {
    const { route_id } = req.params;
    const {
      route_name,
      delivery_person_id,
      route_date,
      total_distance_km,
      estimated_time_hours,
      optimized_waypoints,
      status,
    } = req.body;

    const route = await DeliveryRoute.findByPk(route_id);
    if (!route) {
      return res.status(404).json({ success: false, message: "Route not found" });
    }

    if (route.status === "cancelled" || route.status === "completed") {
      return res.status(409).json({
        success: false,
        message: `Cannot update a ${route.status} route`,
      });
    }

    // Validate new delivery_person_id if being changed
    if (delivery_person_id && delivery_person_id !== route.delivery_person_id) {
      const person = await DeliveryPersonnel.findByPk(delivery_person_id);
      if (!person) {
        return res.status(404).json({ success: false, message: "Delivery personnel not found" });
      }
    }

    const allowedStatuses = ["planned", "in_progress", "completed", "cancelled"];
    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `status must be one of: ${allowedStatuses.join(", ")}`,
      });
    }

    const updates = {};
    if (route_name !== undefined) updates.route_name = route_name;
    if (delivery_person_id !== undefined) updates.delivery_person_id = delivery_person_id;
    if (route_date !== undefined) updates.route_date = route_date;
    if (total_distance_km !== undefined) updates.total_distance_km = total_distance_km;
    if (estimated_time_hours !== undefined) updates.estimated_time_hours = estimated_time_hours;
    if (optimized_waypoints !== undefined) updates.optimized_waypoints = optimized_waypoints;
    if (status !== undefined) {
      updates.status = status;
      if (status === "in_progress") updates.start_time = new Date();
      if (status === "completed") updates.end_time = new Date();
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: "No valid fields provided to update" });
    }

    await DeliveryRoute.update(updates, { where: { route_id } });

    return res.status(200).json({
      success: true,
      message: "Route updated successfully",
    });
  } catch (error) {
    console.error("updateRoute error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};