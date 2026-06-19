const db = require("../../models");
const { Op } = require("sequelize");

// ─── GET /admin/vendors ────────────────────────────────────────
// List all vendors with filters & pagination
exports.getAllVendors = async (req, res) => {
  try {
    const page     = parseInt(req.query.page)  || 1;
    const limit    = parseInt(req.query.limit) || 10;
    const offset   = (page - 1) * limit;

    const { search, business_type, is_active, state_id, district_id, city_id } = req.query;

    // ─── Build where clause ───────────────────────────────────
    const where = {};

    if (search) {
      where[Op.or] = [
        { shop_name:  { [Op.like]: `%${search}%` } },
        { owner_name: { [Op.like]: `%${search}%` } },
        { gst_number: { [Op.like]: `%${search}%` } },
      ];
    }
    if (business_type) where.business_type = business_type;
    if (state_id)      where.state_id      = state_id;
    if (district_id)   where.district_id   = district_id;
    if (city_id)       where.city_id       = city_id;

    // is_active comes as string from query
    if (is_active !== undefined) where["$user.is_active$"] = is_active === "true";

    const { count, rows } = await db.Vendor.findAndCountAll({
      where,
      include: [
        {
          model: db.User,
          as: "user",
          attributes: ["user_id", "mobile_number", "email", "is_active", "is_verified", "created_at"],
        },
        { model: db.State,    as: "state_info",    attributes: ["state_id", "state_name"] },
        { model: db.District, as: "district_info", attributes: ["district_id", "district_name"] },
        { model: db.City,     as: "city_info",     attributes: ["city_id", "city_name"] },
      ],
      order:  [["created_at", "DESC"]],
      limit,
      offset,
      subQuery: false,
    });

    return res.json({
      success: true,
      data: {
        vendors: rows,
        pagination: {
          total:        count,
          total_pages:  Math.ceil(count / limit),
          current_page: page,
          per_page:     limit,
        },
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── GET /admin/vendors/:id ────────────────────────────────────
// Get single vendor full details
exports.getVendorById = async (req, res) => {
  try {
    const vendor = await db.Vendor.findOne({
      where: { vendor_id: parseInt(req.params.id) },
      include: [
        {
          model: db.User,
          as: "user",
          attributes: ["user_id", "mobile_number", "email", "is_active", "is_verified", "last_login", "created_at"],
        },
        { model: db.State,    as: "state_info",    attributes: ["state_id", "state_name"] },
        { model: db.District, as: "district_info", attributes: ["district_id", "district_name"] },
        { model: db.City,     as: "city_info",     attributes: ["city_id", "city_name"] },
        {
          model: db.VendorAddress,
          as: "addresses",
          where: { is_active: true },
          required: false,
        },
      ],
    });

    if (!vendor) return res.status(404).json({ success: false, message: "Vendor not found" });

    // ─── Summary stats ────────────────────────────────────────
    const [totalOrders, totalRevenue, pendingOrders] = await Promise.all([
      db.Order.count({
        where: { vendor_id: vendor.vendor_id },
      }),
      db.Payment.sum("amount", {
        where: {
          vendor_id:      vendor.vendor_id,
          payment_status: "success",
        },
      }),
      db.Order.count({
        where: {
          vendor_id:    vendor.vendor_id,
          order_status: { [Op.in]: ["placed", "confirmed", "processing"] },
        },
      }),
    ]);

    return res.json({
      success: true,
      data: {
        ...vendor.toJSON(),
        stats: {
          total_orders:   totalOrders,
          total_revenue:  totalRevenue || 0,
          pending_orders: pendingOrders,
        },
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── PATCH /admin/vendors/:id/activate ───────────────────
// Activate a vendor (sets user.is_active = true)
exports.activateVendor = async (req, res) => {
  try {
    const vendor = await db.Vendor.findOne({
      where: { vendor_id: parseInt(req.params.id) },
      include: [{ model: db.User, as: "user" }],
    });

    if (!vendor) {
      return res.status(404).json({ success: false, message: "Vendor not found" });
    }

    if (!vendor.user) {
      return res.status(400).json({ 
        success: false, 
        message: "Vendor has no associated user account" 
      });
    }

    // If already active, return early
    if (vendor.user.is_active) {
      return res.json({
        success: true,
        message: "Vendor is already active",
        data: {
          vendor_id: vendor.vendor_id,
          is_active: true,
        },
      });
    }

    await vendor.user.update({ is_active: true });

    return res.json({
      success: true,
      message: "Vendor activated successfully",
      data: {
        vendor_id: vendor.vendor_id,
        is_active: true,
      },
    });
  } catch (err) {
    console.error("Activate vendor error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── PATCH /admin/vendors/:id/deactivate ───────────────────
// Deactivate a vendor (sets user.is_active = false)
exports.deactivateVendor = async (req, res) => {
  try {
    const vendor = await db.Vendor.findOne({
      where: { vendor_id: parseInt(req.params.id) },
      include: [{ model: db.User, as: "user" }],
    });

    if (!vendor) {
      return res.status(404).json({ success: false, message: "Vendor not found" });
    }

    if (!vendor.user) {
      return res.status(400).json({ 
        success: false, 
        message: "Vendor has no associated user account" 
      });
    }

    // If already inactive, return early
    if (!vendor.user.is_active) {
      return res.json({
        success: true,
        message: "Vendor is already inactive",
        data: {
          vendor_id: vendor.vendor_id,
          is_active: false,
        },
      });
    }

    await vendor.user.update({ is_active: false });

    return res.json({
      success: true,
      message: "Vendor deactivated successfully",
      data: {
        vendor_id: vendor.vendor_id,
        is_active: false,
      },
    });
  } catch (err) {
    console.error("Deactivate vendor error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── GET /admin/vendors/:id/orders ────────────────────────────
// Get all orders of a vendor with pagination
exports.getVendorOrders = async (req, res) => {
  try {
    const page   = parseInt(req.query.page)  || 1;
    const limit  = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const { order_status, payment_status } = req.query;

    const vendor = await db.Vendor.findOne({ where: { vendor_id: parseInt(req.params.id) } });
    if (!vendor) return res.status(404).json({ success: false, message: "Vendor not found" });

    const where = { vendor_id: vendor.vendor_id };
    if (order_status)   where.order_status   = order_status;
    if (payment_status) where.payment_status = payment_status;

    const { count, rows } = await db.Order.findAndCountAll({
      where,
      include: [
        {
          model: db.OrderItem,
          as: "items",                          // ✓ from index: Order.hasMany(OrderItem, as: "items")
          include: [
            { model: db.Product, as: "product", attributes: ["product_id", "product_name", "unit"] },
          ],
        },
        {
          model: db.Payment,
          as: "payments",                       // ✓ from index: Order.hasMany(Payment, as: "payments")
          attributes: ["payment_id", "payment_method", "payment_status", "amount", "transaction_date"],
        },
      ],
      order:  [["created_at", "DESC"]],
      limit,
      offset,
    });

    return res.json({
      success: true,
      data: {
        orders: rows,
        pagination: {
          total:        count,
          total_pages:  Math.ceil(count / limit),
          current_page: page,
          per_page:     limit,
        },
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── GET /admin/vendors/:id/payments ──────────────────────────
// Get all payments of a vendor with pagination
exports.getVendorPayments = async (req, res) => {
  try {
    const page   = parseInt(req.query.page)  || 1;
    const limit  = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const { payment_status, payment_method } = req.query;

    const vendor = await db.Vendor.findOne({ where: { vendor_id: parseInt(req.params.id) } });
    if (!vendor) return res.status(404).json({ success: false, message: "Vendor not found" });

    const where = { vendor_id: vendor.vendor_id };
    if (payment_status) where.payment_status = payment_status;
    if (payment_method) where.payment_method = payment_method;

    const { count, rows } = await db.Payment.findAndCountAll({
      where,
      include: [
        {
          model: db.Order,
          as: "order",
          attributes: ["order_id", "order_number", "order_status", "final_amount"],
        },
      ],
      order:  [["created_at", "DESC"]],
      limit,
      offset,
    });

    // ─── Payment summary ──────────────────────────────────────
    const [totalSuccess, totalFailed, totalRefunded] = await Promise.all([
      db.Payment.sum("amount", { where: { vendor_id: vendor.vendor_id, payment_status: "success" } }),
      db.Payment.count({               where: { vendor_id: vendor.vendor_id, payment_status: "failed"  } }),
      db.Payment.sum("refund_amount", { where: { vendor_id: vendor.vendor_id, payment_status: "refunded" } }),
    ]);

    return res.json({
      success: true,
      data: {
        payments: rows,
        summary: {
          total_success_amount:  totalSuccess  || 0,
          total_failed_count:    totalFailed   || 0,
          total_refunded_amount: totalRefunded || 0,
        },
        pagination: {
          total:        count,
          total_pages:  Math.ceil(count / limit),
          current_page: page,
          per_page:     limit,
        },
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── GET /admin/vendors/:id/addresses ─────────────────────────
// Get all addresses of a vendor
exports.getVendorAddresses = async (req, res) => {
  try {
    const vendor = await db.Vendor.findOne({ where: { vendor_id: parseInt(req.params.id) } });
    if (!vendor) return res.status(404).json({ success: false, message: "Vendor not found" });

    const addresses = await db.VendorAddress.findAll({
      where:  { vendor_id: vendor.vendor_id },
      order:  [["is_default", "DESC"], ["created_at", "ASC"]],
    });

    return res.json({
      success: true,
      data: { addresses },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};