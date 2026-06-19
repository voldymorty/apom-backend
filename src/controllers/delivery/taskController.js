const db = require("../../models");
const { Op } = require("sequelize");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// ─── Multer for Proof Photos ─────────────────────────────────────────────────
const proofStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folder = path.join(
      __dirname,
      "../../uploads",
      req.user.mobile_number,
      "proofs"
    );
    if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
    cb(null, folder);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}_proof${ext}`);
  },
});

const proofFilter = (req, file, cb) => {
  const allowed = ["image/jpeg", "image/png", "image/jpg", "image/webp"];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error("Only image files are allowed"), false);
};

const proofUpload = multer({
  storage: proofStorage,
  fileFilter: proofFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

exports.uploadProofPhoto = proofUpload.single("proof_photo");

// ─── Helper ──────────────────────────────────────────────────────────────────
const getDeliveryPerson = (user_id) =>
  db.DeliveryPersonnel.findOne({ where: { user_id } });

const injectVirtualCropForDelivery = async (taskJson) => {
  if (taskJson && taskJson.delivery_type === "delivery" && taskJson.order_id) {
    const orderItems = await db.OrderItem.findAll({
      where: { order_id: taskJson.order_id },
      include: [{ model: db.Product, as: "product" }],
    });
    taskJson.crop = {
      crop_id: 0,
      quantity_kg: taskJson.expected_quantity_kg,
      product: {
        product_name: orderItems
          .map((item) => `${item.product?.product_name || "Product"} (${item.quantity_kg}kg)`)
          .join(", "),
      },
    };
  }
  return taskJson;
};

// Shared include for task list responses
const taskListInclude = [
  {
    model: db.Farmer,
    as: "farmer",
    attributes: ["full_name", "location_address"],
    include: [{ model: db.User, as: "user", attributes: ["mobile_number"] }],
  },
  {
    model: db.Vendor,
    as: "vendor",
    attributes: ["shop_name", "owner_name"],
    include: [{ model: db.User, as: "user", attributes: ["mobile_number"] }],
  },
  {
    model: db.FarmerCrop,
    as: "crop",
    include: [
      { model: db.Product, as: "product", attributes: ["product_name", "unit"] },
    ],
  },
  {
    model: db.Order,
    as: "order",
    attributes: ["order_number", "order_status"],
  },
];

// ─── GET /delivery/tasks ─────────────────────────────────────────────────────
// Query: type (pickup|delivery), status, date, page, limit
// Maps directly to the PICKUPS / DROPS tabs in the Flutter TaskScreen
exports.getTasks = async (req, res) => {
  try {
    const dp = await getDeliveryPerson(req.user.user_id);
    if (!dp)
      return res
        .status(404)
        .json({ success: false, message: "Delivery profile not found" });

    const { type, status, date, page = 1, limit = 20 } = req.query;
    const where = { delivery_person_id: dp.delivery_person_id };

    if (type)   where.delivery_type  = type;
    if (status) where.status         = status;
    if (date)   where.scheduled_date = date;

    const { count, rows } = await db.PickupDelivery.findAndCountAll({
      where,
      include: taskListInclude,
      limit:   parseInt(limit),
      offset:  (parseInt(page) - 1) * parseInt(limit),
      order: [
        ["scheduled_date",      "ASC"],
        ["scheduled_time_slot", "ASC"],
        ["delivery_type",       "ASC"], // pickups before deliveries in same slot
      ],
    });

    const mappedRows = [];
    for (const row of rows) {
      mappedRows.push(await injectVirtualCropForDelivery(row.toJSON()));
    }

    return res.json({
      success:    true,
      data:       mappedRows,
      total:      count,
      page:       parseInt(page),
      limit:      parseInt(limit),
      totalPages: Math.ceil(count / parseInt(limit)),
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── GET /delivery/tasks/:delivery_id ────────────────────────────────────────
// Full task detail with status history — used by PickupDetailsScreen & DeliveryDetailsScreen
exports.getTaskById = async (req, res) => {
  try {
    const dp = await getDeliveryPerson(req.user.user_id);
    if (!dp)
      return res
        .status(404)
        .json({ success: false, message: "Delivery profile not found" });

    const task = await db.PickupDelivery.findOne({
      where: {
        delivery_id:        req.params.delivery_id,
        delivery_person_id: dp.delivery_person_id,
      },
      include: [
        {
          model: db.Farmer,
          as: "farmer",
          include: [{ model: db.User, as: "user", attributes: ["mobile_number"] }],
        },
        {
          model: db.Vendor,
          as: "vendor",
          include: [{ model: db.User, as: "user", attributes: ["mobile_number"] }],
        },
        {
          model: db.FarmerCrop,
          as: "crop",
          include: [{ model: db.Product, as: "product" }],
        },
        { model: db.Order, as: "order" },
        {
          model: db.DeliveryStatusHistory,
          as: "status_history",
          order: [["created_at", "ASC"]],
        },
      ],
    });

    if (!task)
      return res.status(404).json({ success: false, message: "Task not found" });

    const taskJson = await injectVirtualCropForDelivery(task.toJSON());
    return res.json({ success: true, data: taskJson });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── PATCH /delivery/tasks/:delivery_id/status ───────────────────────────────
exports.updateTaskStatus = async (req, res) => {
  try {
    const dp = await getDeliveryPerson(req.user.user_id);
    if (!dp) return res.status(404).json({ success: false, message: "Delivery profile not found" });

    const { status, delivery_notes, failure_reason } = req.body;
    const task = await db.PickupDelivery.findOne({ where: { delivery_id: req.params.delivery_id, delivery_person_id: dp.delivery_person_id } });
    if (!task) return res.status(404).json({ success: false, message: "Task not found" });

    const transitions = {
      assigned: ["accepted", "cancelled"],
      accepted: ["in_transit", "cancelled"],
      in_transit: ["reached", "failed"],
      reached: ["completed", "failed"],
      failed: [],
      completed: []
    };

    if (!transitions[task.status]?.includes(status)) {
      return res.status(400).json({ success: false, message: `Cannot transition from ${task.status} to ${status}` });
    }

    const updateData = { status };
    if (status === "accepted") updateData.accepted_at = new Date();
    if (status === "in_transit") updateData.started_at = new Date();
    if (status === "reached") updateData.reached_at = new Date();
    if (delivery_notes) updateData.delivery_notes = delivery_notes;

    const t = await db.sequelize.transaction();
    try {
      await task.update(updateData, { transaction: t });
      await db.DeliveryStatusHistory.create({
        delivery_id: task.delivery_id,
        old_status: task.status,
        new_status: status,
        changed_by: req.user.user_id,
        remarks: delivery_notes || failure_reason
      }, { transaction: t });

      if (task.delivery_type === "delivery" && task.order_id) {
        let order_status = null;
        if (status === "accepted") order_status = "processing";
        else if (status === "in_transit") order_status = "dispatched";
        else if (status === "cancelled") order_status = "confirmed";

        if (order_status) {
          await db.Order.update(
            { order_status },
            { where: { order_id: task.order_id }, transaction: t }
          );
        }
      }

      await t.commit();

      // Trigger status change notifications asynchronously in the background
      const { notifyStatusChange } = require("../../utils/notificationService");
      notifyStatusChange(task, status).catch((err) =>
        console.error("🔔 Error calling notifyStatusChange:", err)
      );
    } catch (err) {
      await t.rollback();
      throw err;
    }

    return res.json({ success: true, message: "Status updated" });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── POST /delivery/tasks/:delivery_id/proof-photo ───────────────────────────
exports.uploadProof = async (req, res) => {
  try {
    const dp = await getDeliveryPerson(req.user.user_id);
    if (!dp)
      return res
        .status(404)
        .json({ success: false, message: "Delivery profile not found" });

    if (!req.file)
      return res
        .status(400)
        .json({ success: false, message: "proof_photo is required" });

    const latitude = parseFloat(req.body.latitude);
    const longitude = parseFloat(req.body.longitude);

    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({
        success: false,
        message: "Valid latitude and longitude are required",
      });
    }

    const task = await db.PickupDelivery.findOne({
      where: {
        delivery_id: req.params.delivery_id,
        delivery_person_id: dp.delivery_person_id,
      },
    });

    if (!task)
      return res.status(404).json({ success: false, message: "Task not found" });

    if (task.proof_photo_url) {
      const oldPath = path.join(__dirname, "../../", task.proof_photo_url);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    const otp_code = String(Math.floor(1000 + Math.random() * 9000));
    const proof_photo_url = `/uploads/${req.user.mobile_number}/proofs/${req.file.filename}`;

    const isPickup = task.delivery_type === "pickup";

    const updatePayload = {
      proof_photo_url,
      otp_code,
      otp_verified_at: null,
    };

    if (isPickup) {
      updatePayload.pickup_latitude = latitude;
      updatePayload.pickup_longitude = longitude;
    } else {
      updatePayload.delivery_latitude = latitude;
      updatePayload.delivery_longitude = longitude;
    }

    await task.update(updatePayload);

    return res.json({
      success: true,
      message: isPickup
        ? "Proof photo uploaded. Share the OTP with the farmer to confirm loading."
        : "Proof photo uploaded. Share the OTP with the recipient to confirm delivery.",
      proof_photo_url,
      otp_code,
      delivery_type: task.delivery_type,
      location: {
        latitude,
        longitude,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── PATCH /delivery/tasks/:delivery_id/verify-otp ───────────────────────────
// Body: { otp_code }
// On success, task is marked as completed (single source of truth for completion).
exports.verifyTaskOtp = async (req, res) => {
  try {
    const dp = await getDeliveryPerson(req.user.user_id);
    if (!dp)
      return res.status(404).json({ success: false, message: "Delivery profile not found" });

    const { otp_code, actual_quantity_kg, procurement_amount } = req.body;
    if (!otp_code)
      return res.status(400).json({ success: false, message: "otp_code is required" });

    const task = await db.PickupDelivery.findOne({
      where: {
        delivery_id:        req.params.delivery_id,
        delivery_person_id: dp.delivery_person_id,
      },
    });
    if (!task)
      return res.status(404).json({ success: false, message: "Task not found" });

    const isPickup = task.delivery_type === "pickup";

    // Already verified — idempotent response
    if (task.otp_verified_at)
      return res.json({ success: true, message: "OTP already verified", data: task });

    if (task.otp_code !== String(otp_code))
      return res.status(400).json({ success: false, message: "Invalid OTP. Please try again." });

    if (isPickup) {
      const qty = parseFloat(actual_quantity_kg);
      const amount = parseFloat(procurement_amount);
      if (!actual_quantity_kg || isNaN(qty) || qty <= 0) {
        return res.status(400).json({
          success: false,
          message: "actual_quantity_kg is required and must be greater than 0 for pickup tasks",
        });
      }
      if (!procurement_amount || isNaN(amount) || amount <= 0) {
        return res.status(400).json({
          success: false,
          message: "procurement_amount is required and must be greater than 0 for pickup tasks",
        });
      }
    }

    const now        = new Date();
    const old_status = task.status;

    const updatePayload = {
      otp_verified_at: now,
      status:          "completed",
      completed_at:    now,
    };

    if (isPickup) {
      const qty = parseFloat(actual_quantity_kg);
      const amount = parseFloat(procurement_amount);
      updatePayload.actual_quantity_kg = qty;
      updatePayload.procurement_amount = amount;
      updatePayload.procurement_price_per_kg = parseFloat((amount / qty).toFixed(2));
      updatePayload.procurement_submitted_at = now;
      updatePayload.procurement_status = "pending_review";
    }

    const transaction = await db.sequelize.transaction();
    try {
      await task.update(updatePayload, { transaction });

      if (isPickup) {
        if (task.crop_id) {
          await db.FarmerCrop.update(
            { status: "picked_up" },
            { where: { crop_id: task.crop_id }, transaction }
          );
        }
      } else if (task.order_id) {
        const orderItems = await db.OrderItem.findAll({
          where: {
            order_id: task.order_id,
            status: { [Op.ne]: "cancelled" },
          },
          transaction,
        });

        for (const item of orderItems) {
          const inventory = await db.Inventory.findOne({
            where: { product_id: item.product_id, grade: item.grade },
            transaction,
            lock: transaction.LOCK.UPDATE,
          });

          if (inventory) {
            const deductQty = parseFloat(item.quantity_kg);
            const currentReserved = parseFloat(inventory.reserved_quantity_kg);
            const currentAvailable = parseFloat(inventory.available_quantity_kg);
            const newReserved = Math.max(0, currentReserved - deductQty);
            const newAvailable = Math.max(0, currentAvailable - deductQty);

            await db.Inventory.update(
              { 
                reserved_quantity_kg: newReserved,
                available_quantity_kg: newAvailable
              },
              { where: { inventory_id: inventory.inventory_id }, transaction }
            );

            await db.InventoryTransaction.create(
              {
                inventory_id: inventory.inventory_id,
                transaction_type: "stock_out",
                quantity_kg: deductQty,
                reference_type: "order",
                reference_id: task.order_id,
                previous_reserved: currentReserved,
                new_reserved: newReserved,
                previous_available: currentAvailable,
                new_available: newAvailable,
                performed_by: req.user.user_id,
                remarks: `Stock out — delivery ${task.delivery_number} completed via OTP`,
              },
              { transaction }
            );
          }

          // Mark each order item as delivered
          await db.OrderItem.update(
            { status: "delivered", delivered_quantity_kg: item.quantity_kg },
            { where: { order_item_id: item.order_item_id }, transaction }
          );
        }

        // Mark the parent order as delivered
        await db.Order.update(
          { order_status: "delivered", actual_delivery_date: new Date() },
          { where: { order_id: task.order_id }, transaction }
        );
      }

      // Single increment — completed_deliveries only counted here, NOT in updateTaskStatus
      await db.DeliveryPersonnel.update(
        {
          completed_deliveries: db.sequelize.literal("completed_deliveries + 1"),
          total_deliveries:     db.sequelize.literal("total_deliveries + 1"),
          is_available:         true,
        },
        { where: { delivery_person_id: dp.delivery_person_id }, transaction }
      );

      await db.DeliveryStatusHistory.create({
        delivery_id: task.delivery_id,
        old_status,
        new_status:  "completed",
        changed_by:  req.user.user_id,
        remarks:     "OTP verified — task completed",
      }, { transaction });

      await transaction.commit();

      // Trigger status change notifications asynchronously in the background
      const { notifyStatusChange } = require("../../utils/notificationService");
      notifyStatusChange(task, "completed").catch((err) =>
        console.error("🔔 Error calling notifyStatusChange:", err)
      );
    } catch (err) {
      await transaction.rollback();
      throw err;
    }

    return res.json({
      success: true,
      message: isPickup
        ? "OTP verified. Pickup completed — sent to admin for procurement review."
        : "OTP verified. Delivery marked as completed.",
      data: task,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};