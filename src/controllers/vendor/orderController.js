const { Op } = require("sequelize");
const db = require("../../models");

// Order status mapping:
// Flutter tabs: "IN TRANSIT" | "DELIVERED" | "CANCELLED"
// DB values:    dispatched/processing/confirmed = in_transit | delivered | cancelled

const STATUS_MAP = {
  placed:    ["placed", "confirmed"],   // ✅ key matches query param
  processing: ["processing", "ready"],
  in_transit: ["dispatched"],
  delivered:  ["delivered"],
  cancelled:  ["cancelled", "returned"],
};

// ─── GET /vendor/orders ────────────────────────────────────────
// Query: status=in_transit|delivered|cancelled, search, page, limit
// ─── GET /vendor/orders ───────────────────────────────────────
exports.getOrders = async (req, res) => {
  try {
    const vendor = await db.Vendor.findOne({ where: { user_id: req.user.user_id } });
    if (!vendor) return res.status(404).json({ success: false, message: "Vendor not found" });

    const {
      status         = "in_transit",
      search,
      order_number,
      payment_status,
      from_date,
      to_date,
      page           = 1,
      limit          = 20,
    } = req.query;

    const offset       = (parseInt(page) - 1) * parseInt(limit);
    const orderStatuses = STATUS_MAP[status] || STATUS_MAP.placed;

    const where = {
      vendor_id:    vendor.vendor_id,
      order_status: { [Op.in]: orderStatuses },
    };

    // exact order number match (takes priority over LIKE search)
    if (order_number?.trim()) {
      where.order_number = order_number.trim();
    } else if (search?.trim()) {
      where.order_number = { [Op.like]: `%${search.trim()}%` };
    }

    if (payment_status?.trim()) {
      where.payment_status = payment_status.trim();
    }

    if (from_date || to_date) {
      where.created_at = {};
      if (from_date) {
        where.created_at[Op.gte] = new Date(from_date);
      }
      if (to_date) {
        const end = new Date(to_date);
        end.setHours(23, 59, 59, 999);
        where.created_at[Op.lte] = end;
      }
    }

    const orders = await db.Order.findAndCountAll({
      where,
      include: [
        {
          model:      db.OrderItem,
          as:         "items",
          attributes: ["order_item_id", "product_id", "grade", "quantity_kg", "price_per_kg", "total_price", "status"],
          include: [{
            model:      db.Product,
            as:         "product",
            attributes: ["product_name", "image_url", "unit"],
          }],
        },
        {
          model:      db.PickupDelivery,
          as:         "deliveries",
          required:   false,
          attributes: ["delivery_id", "delivery_number", "status", "estimated_time_minutes"],
          include: [{
            model:      db.DeliveryPersonnel,
            as:         "delivery_person",
            required:   false,
            attributes: ["full_name", "vehicle_type", "vehicle_number", "profile_photo_url"],
            include: [{
              model:      db.User,
              as:         "user",
              attributes: ["mobile_number"],
            }],
          }],
        },
      ],
      order:    [["created_at", "DESC"]],
      limit:    parseInt(limit),
      offset,
      distinct: true,
    });

    const result = orders.rows.map((o) => formatOrder(o));

    return res.json({
      success: true,
      data: {
        orders: result,
        pagination: {
          total:       orders.count,
          page:        parseInt(page),
          limit:       parseInt(limit),
          total_pages: Math.ceil(orders.count / parseInt(limit)),
        },
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── GET /vendor/orders/:order_id ─────────────────────────────
exports.getOrderDetail = async (req, res) => {
  try {
    const vendor = await db.Vendor.findOne({ where: { user_id: req.user.user_id } });
    if (!vendor) return res.status(404).json({ success: false, message: "Vendor not found" });

    const order = await db.Order.findOne({
      where: { order_id: req.params.order_id, vendor_id: vendor.vendor_id },
      include: [
        {
          model: db.OrderItem,
          as: "items",
          include: [{
            model: db.Product,
            as: "product",
            attributes: ["product_name", "image_url", "unit", "description"],
          }],
        },
        {
          model: db.PickupDelivery,
          as: "deliveries",
          required: false,
          include: [
            {
              model: db.DeliveryPersonnel,
              as: "delivery_person",
              required: false,
              attributes: ["full_name", "vehicle_type", "vehicle_number", "profile_photo_url"],
              include: [{
                model: db.User,
                as: "user",
                attributes: ["mobile_number"],
              }],
            },
            {
              model: db.DeliveryStatusHistory,
              as: "status_history",
              required: false,
              attributes: ["new_status", "remarks", "created_at"],
              order: [["created_at", "ASC"]],
            },
          ],
        },
      ],
    });

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const timeline = buildTimeline(order);
    const latestDelivery = order.deliveries?.[0] || null;

    return res.json({
      success: true,
      data: {
        order_id:       order.order_id,
        order_number:   order.order_number,
        order_status:   order.order_status,
        flutter_status: mapToFlutterStatus(order.order_status),
        payment_status: order.payment_status,
        order_date:     order.order_date || order.created_at,
        expected_delivery_date: order.expected_delivery_date,
        actual_delivery_date:   order.actual_delivery_date,
        cancelled_at:           order.cancelled_at,
        cancellation_reason:    order.cancellation_reason,
        delivery_address:       order.delivery_address,
        special_instructions:   order.special_instructions,
        items_count:      order.items?.length || 0,
        items:            order.items?.map(formatOrderItem) || [],
        subtotal:         parseFloat(order.subtotal_amount),
        tax_amount:       parseFloat(order.tax_amount),
        delivery_charges: parseFloat(order.delivery_charges),
        final_amount:     parseFloat(order.final_amount),
        timeline,
        status_history: latestDelivery?.status_history?.map((h) => ({
          status:     h.new_status,
          notes:      h.remarks,
          created_at: h.created_at,
        })) || [],
        delivery_person: latestDelivery?.delivery_person
          ? {
              name:           latestDelivery.delivery_person.full_name,
              vehicle_type:   latestDelivery.delivery_person.vehicle_type,
              vehicle_number: latestDelivery.delivery_person.vehicle_number,
              photo_url:      latestDelivery.delivery_person.profile_photo_url,
              mobile:         latestDelivery.delivery_person.user?.mobile_number,
              eta:            latestDelivery.estimated_time_minutes
                                ? `${latestDelivery.estimated_time_minutes} mins`
                                : null,
            }
          : null,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── POST /vendor/orders/:order_id/cancel ─────────────────────
exports.cancelOrder = async (req, res) => {
  try {
    const vendor = await db.Vendor.findOne({ where: { user_id: req.user.user_id } });
    if (!vendor) return res.status(404).json({ success: false, message: "Vendor not found" });

    const order = await db.Order.findOne({
      where: { order_id: req.params.order_id, vendor_id: vendor.vendor_id },
    });

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const cancellable = ["placed", "confirmed"];
    if (!cancellable.includes(order.order_status)) {
      return res.status(400).json({
        success: false,
        message: `Order cannot be cancelled in '${order.order_status}' status`,
      });
    }

    const t = await db.sequelize.transaction();

    try {
      await order.update(
        {
          order_status:        "cancelled",
          cancellation_reason: req.body.reason || "Cancelled by vendor",
          cancelled_by:        req.user.user_id,
          cancelled_at:        new Date(),
        },
        { transaction: t }
      );

      await db.OrderItem.update(
        { status: "cancelled" },
        { where: { order_id: order.order_id, status: "placed" }, transaction: t }
      );

      // ── Cancel any linked delivery task ──
      const deliveryTask = await db.PickupDelivery.findOne({
        where: {
          order_id: order.order_id,
          delivery_type: "delivery",
          status: { [Op.notIn]: ["completed", "cancelled"] },
        },
        transaction: t,
      });

      if (deliveryTask) {
        const oldStatus = deliveryTask.status;
        await db.PickupDelivery.update(
          { status: "cancelled" },
          { where: { delivery_id: deliveryTask.delivery_id }, transaction: t }
        );

        await db.DeliveryStatusHistory.create(
          {
            delivery_id: deliveryTask.delivery_id,
            old_status:  oldStatus,
            new_status:  "cancelled",
            changed_by:  req.user.user_id,
            remarks:     `Delivery cancelled — order #${order.order_number} cancelled by vendor`,
          },
          { transaction: t }
        );
      }

      await t.commit();
    } catch (innerError) {
      await t.rollback();
      throw innerError;
    }

    return res.json({
      success: true,
      message: "Order cancelled successfully",
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ═══════════════════════════════════════════════════════════════
// ADDRESS MANAGEMENT
// ═══════════════════════════════════════════════════════════════

// ─── GET /vendor/orders/addresses ─────────────────────────────
// Returns all active addresses (used in checkout address picker)
exports.getAddresses = async (req, res) => {
  try {
    const vendor = await db.Vendor.findOne({ where: { user_id: req.user.user_id } });
    if (!vendor) return res.status(404).json({ success: false, message: "Vendor not found" });

    const addresses = await db.VendorAddress.findAll({
      where: { vendor_id: vendor.vendor_id, is_active: true },
      order: [["is_default", "DESC"], ["created_at", "ASC"]],
    });

    return res.json({
      success: true,
      data: addresses,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── POST /vendor/orders/addresses ────────────────────────────
// Body: { address_label, contact_person, contact_number,
//         address_line1, address_line2, landmark,
//         city, state, pincode, latitude, longitude, is_default }
exports.addAddress = async (req, res) => {
  try {
    const vendor = await db.Vendor.findOne({ where: { user_id: req.user.user_id } });
    if (!vendor) return res.status(404).json({ success: false, message: "Vendor not found" });

    const {
      address_label,
      contact_person,
      contact_number,
      address_line1,
      address_line2,
      landmark,
      city,
      district,
      state,
      pincode,
      latitude,
      longitude,
      is_default = false,
    } = req.body;

    if (!address_label?.trim()) {
      return res.status(400).json({ success: false, message: "address_label is required (e.g. Main Shop, Branch 1)" });
    }
    if (!address_line1?.trim()) {
      return res.status(400).json({ success: false, message: "address_line1 is required" });
    }
    if (!city?.trim()) {
      return res.status(400).json({ success: false, message: "city is required" });
    }
    if (!state?.trim()) {
      return res.status(400).json({ success: false, message: "state is required" });
    }
    if (!pincode?.trim() || pincode.trim().length !== 6) {
      return res.status(400).json({ success: false, message: "A valid 6-digit pincode is required" });
    }

    // Unset existing default if new one is being set as default
    if (is_default) {
      await db.VendorAddress.update(
        { is_default: false },
        { where: { vendor_id: vendor.vendor_id, is_default: true } }
      );
    }

    const address = await db.VendorAddress.create({
      vendor_id:      vendor.vendor_id,
      address_label:  address_label.trim(),
      contact_person: contact_person?.trim() || null,
      contact_number: contact_number?.trim() || null,
      address_line1:  address_line1.trim(),
      address_line2:  address_line2?.trim()  || null,
      landmark:       landmark?.trim()       || null,
      city:           city.trim(),
      district:       district.trim(),
      state:          state.trim(),
      pincode:        pincode.trim(),
      latitude:       latitude  || null,
      longitude:      longitude || null,
      is_default:     Boolean(is_default),
      is_active:      true,
    });

    return res.status(201).json({
      success: true,
      message: "Address added successfully",
      data: address,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── PUT /vendor/orders/addresses/:address_id ─────────────────
exports.updateAddress = async (req, res) => {
  try {
    const vendor = await db.Vendor.findOne({ where: { user_id: req.user.user_id } });
    if (!vendor) return res.status(404).json({ success: false, message: "Vendor not found" });

    const address = await db.VendorAddress.findOne({
      where: { address_id: req.params.address_id, vendor_id: vendor.vendor_id, is_active: true },
    });

    if (!address) {
      return res.status(404).json({ success: false, message: "Address not found" });
    }

    const {
      address_label,
      contact_person,
      contact_number,
      address_line1,
      address_line2,
      landmark,
      city,
      state,
      pincode,
      latitude,
      longitude,
      is_default,
    } = req.body;

    if (pincode && pincode.trim().length !== 6) {
      return res.status(400).json({ success: false, message: "Pincode must be exactly 6 digits" });
    }

    if (is_default) {
      await db.VendorAddress.update(
        { is_default: false },
        { where: { vendor_id: vendor.vendor_id, is_default: true } }
      );
    }

    await address.update({
      address_label:  address_label?.trim()  || address.address_label,
      contact_person: contact_person?.trim() || address.contact_person,
      contact_number: contact_number?.trim() || address.contact_number,
      address_line1:  address_line1?.trim()  || address.address_line1,
      address_line2:  address_line2  !== undefined ? (address_line2?.trim()  || null) : address.address_line2,
      landmark:       landmark       !== undefined ? (landmark?.trim()       || null) : address.landmark,
      city:           city?.trim()           || address.city,
      state:          state?.trim()          || address.state,
      pincode:        pincode?.trim()        || address.pincode,
      latitude:       latitude  !== undefined ? (latitude  || null) : address.latitude,
      longitude:      longitude !== undefined ? (longitude || null) : address.longitude,
      is_default:     is_default !== undefined ? Boolean(is_default) : address.is_default,
    });

    return res.json({
      success: true,
      message: "Address updated successfully",
      data: address,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── PATCH /vendor/orders/addresses/:address_id/set-default ───
exports.setDefaultAddress = async (req, res) => {
  try {
    const vendor = await db.Vendor.findOne({ where: { user_id: req.user.user_id } });
    if (!vendor) return res.status(404).json({ success: false, message: "Vendor not found" });

    const address = await db.VendorAddress.findOne({
      where: { address_id: req.params.address_id, vendor_id: vendor.vendor_id, is_active: true },
    });

    if (!address) {
      return res.status(404).json({ success: false, message: "Address not found" });
    }

    await db.VendorAddress.update(
      { is_default: false },
      { where: { vendor_id: vendor.vendor_id, is_default: true } }
    );

    await address.update({ is_default: true });

    return res.json({
      success: true,
      message: "Default address updated",
      data: address,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── DELETE /vendor/orders/addresses/:address_id ──────────────
// Soft delete — prevents removing last active address
exports.removeAddress = async (req, res) => {
  try {
    const vendor = await db.Vendor.findOne({ where: { user_id: req.user.user_id } });
    if (!vendor) return res.status(404).json({ success: false, message: "Vendor not found" });

    const address = await db.VendorAddress.findOne({
      where: { address_id: req.params.address_id, vendor_id: vendor.vendor_id, is_active: true },
    });

    if (!address) {
      return res.status(404).json({ success: false, message: "Address not found" });
    }

    const activeCount = await db.VendorAddress.count({
      where: { vendor_id: vendor.vendor_id, is_active: true },
    });

    if (activeCount <= 1) {
      return res.status(400).json({
        success: false,
        message: "Cannot remove the only active address. Add a new address first.",
      });
    }

    // If removing default, auto-promote next oldest
    if (address.is_default) {
      const next = await db.VendorAddress.findOne({
        where: {
          vendor_id:  vendor.vendor_id,
          is_active:  true,
          address_id: { [Op.ne]: address.address_id },
        },
        order: [["created_at", "ASC"]],
      });
      if (next) await next.update({ is_default: true });
    }

    await address.update({ is_active: false, is_default: false });

    return res.json({
      success: true,
      message: "Address removed successfully",
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function mapToFlutterStatus(dbStatus) {
  if (["placed", "confirmed"].includes(dbStatus))              return "PLACED";
  if (["processing", "ready"].includes(dbStatus))              return "PROCESSING";
  if (dbStatus === "dispatched")                               return "IN TRANSIT";
  if (dbStatus === "delivered")                                return "DELIVERED";
  if (["cancelled", "returned"].includes(dbStatus))            return "CANCELLED";
  return dbStatus.toUpperCase();
}

function formatOrder(order) {
  const delivery  = order.deliveries?.[0] || null;
  const firstItem = order.items?.[0];

  return {
    id:             `ORD-${order.order_id}`,
    order_id:       order.order_id,
    order_number:   order.order_number,
    order_status:   order.order_status,                    // ✅ raw DB value  e.g. "placed"
    status:         mapToFlutterStatus(order.order_status), // keep for backward compat
    payment_status: order.payment_status,                  // ✅ was missing from formatOrder
    reason:         order.cancellation_reason,
    price:          parseFloat(order.final_amount),
    date:           formatDate(order.order_date || order.created_at),
    items_count:    order.items?.length || 0,
    items_list: (order.items || []).map((i) => ({
      product_name: i.product?.product_name || null,
      quantity_kg:  i.quantity_kg,
    })),
    image:              firstItem?.product?.image_url || null,
    eta:                delivery?.estimated_time_minutes != null
                          ? `${delivery.estimated_time_minutes} mins`
                          : null,
    estimated_delivery: order.expected_delivery_date ? formatDate(order.expected_delivery_date) : null,
    delivery_date:      order.actual_delivery_date   ? formatDate(order.actual_delivery_date)   : null,
    cancelled_date:     order.cancelled_at           ? formatDate(order.cancelled_at)            : null,
    delivery_person: delivery?.delivery_person
      ? {
          name:           delivery.delivery_person.full_name,
          vehicle_number: delivery.delivery_person.vehicle_number,
          mobile:         delivery.delivery_person.user?.mobile_number,
        }
      : null,
  };
}

function formatOrderItem(item) {
  return {
    order_item_id: item.order_item_id,
    product_name:  item.product?.product_name,
    image_url:     item.product?.image_url,
    unit:          item.product?.unit,
    grade:         item.grade,
    quantity_kg:   parseFloat(item.quantity_kg),
    price_per_kg:  parseFloat(item.price_per_kg),
    total_price:   parseFloat(item.total_price),
    status:        item.status,
  };
}

function buildTimeline(order) {
  const status = order.order_status;
  return [
    { key: "placed",     label: "Order Placed",    completed: true },
    { key: "confirmed",  label: "Order Confirmed",  completed: ["confirmed", "processing", "ready", "dispatched", "delivered"].includes(status) },
    { key: "dispatched", label: "Out for Delivery", completed: status === "delivered", active: ["ready", "dispatched"].includes(status) },
    { key: "delivered",  label: "Delivered",        completed: status === "delivered" },
  ];
}

function formatDate(d) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}