"use strict";

const { FarmerEarning, Farmer, FarmerCrop, PickupDelivery, Product, User } = require("../../models");
const { Op } = require("sequelize");

const VALID_PAYMENT_STATUSES = ["pending", "processing", "paid", "failed"];
const VALID_PAYMENT_METHODS  = ["bank_transfer", "upi", "cash", "cheque"];

// ─── Common farmer include ────────────────────────────────────────────────────
const farmerInclude = {
  model: Farmer,
  as: "farmer",
  attributes: ["farmer_id", "full_name", "farm_name"],
  include: [
    {
      model: User,
      as: "user",
      attributes: ["user_id", "mobile_number"],
    },
  ],
};

const cropInclude = {
  model: FarmerCrop,
  as: "crop",
  attributes: ["crop_id", "grade", "quantity_kg", "harvest_date"],
  include: [
    {
      model: Product,
      as: "product",
      attributes: ["product_id", "product_name", "product_code", "unit"],
    },
  ],
};

const deliveryInclude = {
  model: PickupDelivery,
  as: "pickupDelivery",
  attributes: ["delivery_id", "delivery_number", "status", "scheduled_date", "completed_at"],
};

// ─── 1. List All Payouts ──────────────────────────────────────────────────────

/**
 * GET /admin/payouts
 * Filters: farmer_id, payment_status, payment_method, from, to
 * Pagination: page, limit
 */
exports.getAllPayouts = async (req, res) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;

    const where = {};

    if (req.query.farmer_id) {
      const fid = parseInt(req.query.farmer_id);
      if (isNaN(fid)) {
        return res.status(400).json({ success: false, message: "farmer_id must be an integer" });
      }
      where.farmer_id = fid;
    }

    if (req.query.payment_status) {
      if (!VALID_PAYMENT_STATUSES.includes(req.query.payment_status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid payment_status. Must be one of: ${VALID_PAYMENT_STATUSES.join(", ")}`,
        });
      }
      where.payment_status = req.query.payment_status;
    }

    if (req.query.payment_method) {
      if (!VALID_PAYMENT_METHODS.includes(req.query.payment_method)) {
        return res.status(400).json({
          success: false,
          message: `Invalid payment_method. Must be one of: ${VALID_PAYMENT_METHODS.join(", ")}`,
        });
      }
      where.payment_method = req.query.payment_method;
    }

    if (req.query.from || req.query.to) {
      where.created_at = {};
      if (req.query.from) where.created_at[Op.gte] = new Date(req.query.from);
      if (req.query.to)   where.created_at[Op.lte] = new Date(`${req.query.to}T23:59:59`);
    }

    const { count, rows } = await FarmerEarning.findAndCountAll({
      where,
      include: [farmerInclude, cropInclude, deliveryInclude],
      order:  [["created_at", "DESC"]],
      limit,
      offset,
    });

    return res.json({
      success: true,
      data: {
        payouts: rows,
        pagination: {
          total:       count,
          page,
          limit,
          total_pages: Math.ceil(count / limit),
        },
      },
    });
  } catch (err) {
    console.error("getAllPayouts:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── 2. Get Single Payout ─────────────────────────────────────────────────────

/**
 * GET /admin/payouts/:id
 */
exports.getPayoutById = async (req, res) => {
  try {
    const payout = await FarmerEarning.findByPk(req.params.id, {
      include: [farmerInclude, cropInclude, deliveryInclude],
    });

    if (!payout) {
      return res.status(404).json({ success: false, message: "Payout record not found" });
    }

    return res.json({ success: true, data: payout });
  } catch (err) {
    console.error("getPayoutById:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── 3. Manually Create Payout ────────────────────────────────────────────────

/**
 * POST /admin/payouts
 */
exports.createPayout = async (req, res) => {
  try {
    const {
      farmer_id,
      crop_id,
      pickup_delivery_id,
      quantity_supplied_kg,
      price_per_kg,
      commission_percentage,
      payment_method,
      remarks,
    } = req.body;

    // ── Required fields ──
    if (!farmer_id || !quantity_supplied_kg || !price_per_kg) {
      return res.status(400).json({
        success: false,
        message: "farmer_id, quantity_supplied_kg, and price_per_kg are required",
      });
    }

    // ── Farmer must exist ──
    const farmer = await Farmer.findByPk(farmer_id);
    if (!farmer) {
      return res.status(404).json({ success: false, message: "Farmer not found" });
    }

    if (payment_method && !VALID_PAYMENT_METHODS.includes(payment_method)) {
      return res.status(400).json({
        success: false,
        message: `Invalid payment_method. Must be one of: ${VALID_PAYMENT_METHODS.join(", ")}`,
      });
    }

    // ── Compute amounts ──
    const totalAmount      = parseFloat(quantity_supplied_kg) * parseFloat(price_per_kg);
    const commissionPct    = parseFloat(commission_percentage ?? 0);
    const commissionAmount = parseFloat(((totalAmount * commissionPct) / 100).toFixed(2));
    const netAmount        = parseFloat((totalAmount - commissionAmount).toFixed(2));

    const payout = await FarmerEarning.create({
      farmer_id,
      crop_id:             crop_id            ?? null,
      pickup_delivery_id:  pickup_delivery_id ?? null,
      quantity_supplied_kg,
      price_per_kg,
      total_amount:        totalAmount,
      commission_percentage: commissionPct,
      commission_amount:   commissionAmount,
      net_amount:          netAmount,
      payment_status:      "pending",
      payment_method:      payment_method ?? null,
      remarks:             remarks        ?? null,
    });

    return res.status(201).json({
      success: true,
      message: "Payout record created successfully",
      data: payout,
    });
  } catch (err) {
    console.error("createPayout:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── 4. Update Payout Status ──────────────────────────────────────────────────

/**
 * PUT /admin/payouts/:id/status
 * Body: { payment_status, payment_method, transaction_reference, transaction_id, remarks }
 */
exports.updatePayoutStatus = async (req, res) => {
  try {
    const payout = await FarmerEarning.findByPk(req.params.id);

    if (!payout) {
      return res.status(404).json({ success: false, message: "Payout record not found" });
    }

    const { payment_status, payment_method, transaction_reference, transaction_id, remarks } = req.body;

    if (!payment_status) {
      return res.status(400).json({ success: false, message: "payment_status is required" });
    }

    if (!VALID_PAYMENT_STATUSES.includes(payment_status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid payment_status. Must be one of: ${VALID_PAYMENT_STATUSES.join(", ")}`,
      });
    }

    // Already in that status
    if (payout.payment_status === payment_status) {
      return res.status(400).json({
        success: false,
        message: `Payout is already in '${payment_status}' status`,
      });
    }

    // Once paid, block moving back to pending
    if (payout.payment_status === "paid" && payment_status === "pending") {
      return res.status(400).json({
        success: false,
        message: "Cannot revert a paid payout back to pending",
      });
    }

    if (payment_method && !VALID_PAYMENT_METHODS.includes(payment_method)) {
      return res.status(400).json({
        success: false,
        message: `Invalid payment_method. Must be one of: ${VALID_PAYMENT_METHODS.join(", ")}`,
      });
    }

    const updateData = {
      payment_status,
      ...(payment_method        && { payment_method }),
      ...(transaction_reference && { transaction_reference }),
      ...(transaction_id        && { transaction_id }),
      ...(remarks               && { remarks }),
      // Stamp payment_date when marking as paid
      ...(payment_status === "paid" && { payment_date: new Date() }),
    };

    await payout.update(updateData);

    return res.json({
      success: true,
      message: `Payout status updated to '${payment_status}' successfully`,
      data: payout,
    });
  } catch (err) {
    console.error("updatePayoutStatus:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};