const { Op } = require("sequelize");
const db = require("../../models");

const {
  Order,
  OrderItem,
  Payment,
  Vendor,
  User,
  Product,
  Inventory,
  InventoryTransaction,
  PickupDelivery,
  DeliveryStatusHistory,
} = db;

// ─────────────────────────────────────────────
// GET /admin/orders
// List all orders with pagination & filters
// ─────────────────────────────────────────────
exports.listOrders = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      order_status,
      payment_status,
      vendor_id,
      from_date,
      to_date,
      search,
      sort_by = "order_date",
      order = "desc",
    } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    const sortableColumns = ["order_date", "final_amount"];
    const sortColumn = sortableColumns.includes(sort_by) ? sort_by : "order_date";
    const sortOrder = order.toLowerCase() === "asc" ? "ASC" : "DESC";

    const where = {};
    if (order_status)   where.order_status   = order_status;
    if (payment_status) where.payment_status = payment_status;
    if (vendor_id)      where.vendor_id      = parseInt(vendor_id);
    if (search)         where.order_number   = { [Op.like]: `%${search}%` };

    if (from_date || to_date) {
      where.order_date = {};
      if (from_date) where.order_date[Op.gte] = new Date(from_date);
      if (to_date) {
        const end = new Date(to_date);
        end.setHours(23, 59, 59, 999);
        where.order_date[Op.lte] = end;
      }
    }

    const { count, rows } = await Order.findAndCountAll({
      where,
      include: [
        {
          model: Vendor,
          as: "vendor",
          attributes: ["vendor_id", "shop_name", "owner_name"],
          include: [
            {
              model: User,
              as: "user",
              attributes: ["mobile_number"],
            },
          ],
        },
      ],
      order: [[sortColumn, sortOrder]],
      limit: limitNum,
      offset,
      distinct: true,
    });

    const totalPages = Math.ceil(count / limitNum);

    return res.status(200).json({
      success: true,
      message: "Orders fetched successfully",
      data: {
        orders: rows.map((o) => ({
          order_id:              o.order_id,
          order_number:          o.order_number,
          order_date:            o.order_date,
          order_status:          o.order_status,
          payment_status:        o.payment_status,
          subtotal_amount:       o.subtotal_amount,
          discount_amount:       o.discount_amount,
          tax_amount:            o.tax_amount,
          delivery_charges:      o.delivery_charges,
          final_amount:          o.final_amount,
          expected_delivery_date:o.expected_delivery_date,
          vendor: {
            vendor_id:     o.vendor?.vendor_id,
            shop_name:     o.vendor?.shop_name,
            owner_name:    o.vendor?.owner_name,
            mobile_number: o.vendor?.user?.mobile_number,
          },
          created_at: o.created_at,
        })),
        pagination: {
          total:       count,
          page:        pageNum,
          limit:       limitNum,
          total_pages: totalPages,
        },
      },
    });
  } catch (error) {
    console.error("listOrders error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─────────────────────────────────────────────
// GET /admin/orders/:order_id
// Full order detail — items + payments + vendor + cancelled_by
// ─────────────────────────────────────────────
exports.getOrderById = async (req, res) => {
  try {
    const { order_id } = req.params;

    const order = await Order.findByPk(order_id, {
      include: [
        {
          model: Vendor,
          as: "vendor",
          attributes: ["vendor_id", "shop_name", "owner_name"],
          include: [
            { model: User, as: "user", attributes: ["mobile_number", "email"] },
          ],
        },
        {
          model: OrderItem,
          as: "items",
          include: [
            {
              model: Product,
              as: "product",
              attributes: ["product_id", "product_name", "product_code", "unit"],
            },
          ],
        },
        {
          model: Payment,
          as: "payments",
          attributes: [
            "payment_id", "payment_method", "amount", "payment_status",
            "razorpay_order_id", "razorpay_payment_id", "razorpay_signature",
            "transaction_id", "transaction_date", "failure_reason",
            "refund_amount", "refund_date", "created_at",
          ],
        },
        {
          model: User,
          as: "cancelled_user",
          attributes: ["user_id", "mobile_number"],
          required: false,
        },
      ],
    });

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Order fetched successfully",
      data: {
        order_id:               order.order_id,
        order_number:           order.order_number,
        order_date:             order.order_date,
        order_status:           order.order_status,
        payment_status:         order.payment_status,
        subtotal_amount:        order.subtotal_amount,
        discount_percentage:    order.discount_percentage,
        discount_amount:        order.discount_amount,
        tax_percentage:         order.tax_percentage,
        tax_amount:             order.tax_amount,
        delivery_charges:       order.delivery_charges,
        final_amount:           order.final_amount,
        delivery_address:       order.delivery_address,
        delivery_latitude:      order.delivery_latitude,
        delivery_longitude:     order.delivery_longitude,
        expected_delivery_date: order.expected_delivery_date,
        actual_delivery_date:   order.actual_delivery_date,
        special_instructions:   order.special_instructions,
        cancellation_reason:    order.cancellation_reason,
        cancelled_at:           order.cancelled_at,
        cancelled_by: order.cancelled_user
          ? {
              user_id:       order.cancelled_user.user_id,
              mobile_number: order.cancelled_user.mobile_number,
            }
          : null,
        vendor: {
          vendor_id:     order.vendor?.vendor_id,
          shop_name:     order.vendor?.shop_name,
          owner_name:    order.vendor?.owner_name,
          mobile_number: order.vendor?.user?.mobile_number,
          email:         order.vendor?.user?.email,
        },
        items:    order.items,
        payments: order.payments,
        created_at: order.created_at,
        updated_at: order.updated_at,
      },
    });
  } catch (error) {
    console.error("getOrderById error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─────────────────────────────────────────────
// PATCH /admin/orders/:order_id/status
// Update order_status (free-set by admin)
// ─────────────────────────────────────────────
exports.updateOrderStatus = async (req, res) => {
  try {
    const { order_id } = req.params;
    const { order_status } = req.body;

    const allowedStatuses = ["confirmed", "processing", "ready", "dispatched", "delivered"];

    if (!order_status) {
      return res.status(400).json({ success: false, message: "order_status is required" });
    }

    if (!allowedStatuses.includes(order_status)) {
      return res.status(400).json({
        success: false,
        message: `order_status must be one of: ${allowedStatuses.join(", ")}`,
      });
    }

    const order = await Order.findByPk(order_id);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.order_status === "cancelled") {
      return res.status(409).json({ success: false, message: "Cannot update status of a cancelled order" });
    }

    const updates = { order_status };

    // If marking as delivered, record actual delivery date
    if (order_status === "delivered") {
      updates.actual_delivery_date = new Date();
    }

    await Order.update(updates, { where: { order_id } });

    // ── Sync linked delivery task status ──
    const orderToDeliveryStatusMap = {
      processing: "accepted",
      dispatched: "in_transit",
      delivered:  "completed",
    };

    const newDeliveryStatus = orderToDeliveryStatusMap[order_status];
    if (newDeliveryStatus) {
      const deliveryTask = await PickupDelivery.findOne({
        where: {
          order_id,
          delivery_type: "delivery",
          status: { [Op.notIn]: ["completed", "cancelled"] },
        },
      });

      if (deliveryTask && deliveryTask.status !== newDeliveryStatus) {
        const oldStatus = deliveryTask.status;
        const taskUpdates = { status: newDeliveryStatus };

        if (newDeliveryStatus === "completed") {
          taskUpdates.completed_at = new Date();
        } else if (newDeliveryStatus === "in_transit") {
          taskUpdates.started_at = new Date();
        } else if (newDeliveryStatus === "accepted") {
          taskUpdates.accepted_at = new Date();
        }

        await PickupDelivery.update(taskUpdates, {
          where: { delivery_id: deliveryTask.delivery_id },
        });

        await DeliveryStatusHistory.create({
          delivery_id: deliveryTask.delivery_id,
          old_status:  oldStatus,
          new_status:  newDeliveryStatus,
          changed_by:  req.user.user_id,
          remarks:     `Synced from admin order status change to '${order_status}'`,
        });
      }
    }

    return res.status(200).json({
      success: true,
      message: "Order status updated successfully",
    });
  } catch (error) {
    console.error("updateOrderStatus error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─────────────────────────────────────────────
// PATCH /admin/orders/:order_id/cancel
// Cancel order + release reserved inventory + log transactions
// ─────────────────────────────────────────────
exports.cancelOrder = async (req, res) => {
  try {
    const { order_id } = req.params;
    const { cancellation_reason } = req.body;

    if (!cancellation_reason) {
      return res.status(400).json({ success: false, message: "cancellation_reason is required" });
    }

    const order = await Order.findByPk(order_id, {
      include: [{ model: OrderItem, as: "items" }],
    });

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.order_status === "cancelled") {
      return res.status(409).json({ success: false, message: "Order is already cancelled" });
    }

    if (order.order_status === "delivered") {
      return res.status(409).json({ success: false, message: "Cannot cancel a delivered order" });
    }

    // Use a transaction to keep inventory + order update atomic
    const t = await db.sequelize.transaction();

    try {
      // Release reserved inventory for each order item
      for (const item of order.items) {
        if (item.status === "cancelled") continue;

        const inventory = await Inventory.findOne({
          where: { product_id: item.product_id, grade: item.grade },
          transaction: t,
          lock: t.LOCK.UPDATE,
        });

        if (inventory) {
          const releaseQty = parseFloat(item.quantity_kg);
          const currentReserved = parseFloat(inventory.reserved_quantity_kg);
          const currentAvailable = parseFloat(inventory.available_quantity_kg);

          const newReserved  = Math.max(0, currentReserved - releaseQty);
          const newAvailable = currentAvailable + (currentReserved - newReserved);

          await Inventory.update(
            {
              reserved_quantity_kg:  newReserved,
              available_quantity_kg: newAvailable,
            },
            { where: { inventory_id: inventory.inventory_id }, transaction: t }
          );

          // Log the inventory adjustment
          await InventoryTransaction.create(
            {
              inventory_id:     inventory.inventory_id,
              transaction_type: "adjustment",
              quantity_kg:      releaseQty,
              reference_type:   "order",
              reference_id:     order_id,
              previous_quantity: currentAvailable,
              new_quantity:      newAvailable,
              performed_by:     req.user.user_id,
              remarks:          `Reserved stock released — order #${order.order_number} cancelled`,
            },
            { transaction: t }
          );
        }

        // Cancel individual order items too
        await OrderItem.update(
          { status: "cancelled" },
          { where: { order_item_id: item.order_item_id }, transaction: t }
        );
      }

      // Cancel the order
      await Order.update(
        {
          order_status:        "cancelled",
          cancellation_reason,
          cancelled_by:        req.user.user_id,
          cancelled_at:        new Date(),
        },
        { where: { order_id }, transaction: t }
      );

      // ── Cancel any linked delivery task ──
      const deliveryTask = await PickupDelivery.findOne({
        where: {
          order_id,
          delivery_type: "delivery",
          status: { [Op.notIn]: ["completed", "cancelled"] },
        },
        transaction: t,
      });

      if (deliveryTask) {
        const oldStatus = deliveryTask.status;
        await PickupDelivery.update(
          { status: "cancelled" },
          { where: { delivery_id: deliveryTask.delivery_id }, transaction: t }
        );

        await DeliveryStatusHistory.create(
          {
            delivery_id: deliveryTask.delivery_id,
            old_status:  oldStatus,
            new_status:  "cancelled",
            changed_by:  req.user.user_id,
            remarks:     `Delivery cancelled — order #${order.order_number} cancelled by admin`,
          },
          { transaction: t }
        );
      }

      await t.commit();

      return res.status(200).json({
        success: true,
        message: "Order cancelled successfully",
      });
    } catch (innerError) {
      await t.rollback();
      throw innerError;
    }
  } catch (error) {
    console.error("cancelOrder error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─────────────────────────────────────────────
// GET /admin/orders/:order_id/items
// Line items for an order
// ─────────────────────────────────────────────
exports.getOrderItems = async (req, res) => {
  try {
    const { order_id } = req.params;

    const order = await Order.findByPk(order_id);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const items = await OrderItem.findAll({
      where: { order_id },
      include: [
        {
          model: Product,
          as: "product",
          attributes: ["product_id", "product_name", "product_code", "unit", "image_url"],
        },
      ],
      order: [["created_at", "ASC"]],
    });

    return res.status(200).json({
      success: true,
      message: "Order items fetched successfully",
      data: { items },
    });
  } catch (error) {
    console.error("getOrderItems error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─────────────────────────────────────────────
// PATCH /admin/orders/:order_id/items/:order_item_id/status
// Update individual order item status
// ─────────────────────────────────────────────
exports.updateOrderItemStatus = async (req, res) => {
  try {
    const { order_id, order_item_id } = req.params;
    const { status } = req.body;

    const allowedStatuses = ["pending", "confirmed", "delivered", "cancelled"];

    if (!status) {
      return res.status(400).json({ success: false, message: "status is required" });
    }

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `status must be one of: ${allowedStatuses.join(", ")}`,
      });
    }

    const order = await Order.findByPk(order_id);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const item = await OrderItem.findOne({
      where: { order_item_id, order_id },
    });

    if (!item) {
      return res.status(404).json({ success: false, message: "Order item not found" });
    }

    await OrderItem.update({ status }, { where: { order_item_id } });

    return res.status(200).json({
      success: true,
      message: "Order item status updated successfully",
    });
  } catch (error) {
    console.error("updateOrderItemStatus error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─────────────────────────────────────────────
// GET /admin/orders/:order_id/payments
// Payment records for an order
// ─────────────────────────────────────────────
exports.getOrderPayments = async (req, res) => {
  try {
    const { order_id } = req.params;

    const order = await Order.findByPk(order_id);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const payments = await Payment.findAll({
      where: { order_id },
      order: [["created_at", "DESC"]],
    });

    return res.status(200).json({
      success: true,
      message: "Order payments fetched successfully",
      data: { payments },
    });
  } catch (error) {
    console.error("getOrderPayments error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};