"use strict";

const { CommissionSetting, User } = require("../../models");
const { Op } = require("sequelize");

// ─── Helpers ─────────────────────────────────────────────────────────────────

const VALID_USER_TYPES    = ["farmer", "vendor", "delivery_personnel", "platform"];
const VALID_COMMISSION_TYPES = ["percentage", "fixed", "tiered"];

// ─── 1. List All Commission Settings ─────────────────────────────────────────

/**
 * GET /admin/commission
 * Supports filters: user_type, is_active
 */
exports.getAllCommissionSettings = async (req, res) => {
  try {
    const where = {};

    if (req.query.user_type) {
      if (!VALID_USER_TYPES.includes(req.query.user_type)) {
        return res.status(400).json({
          success: false,
          message: `Invalid user_type. Must be one of: ${VALID_USER_TYPES.join(", ")}`,
        });
      }
      where.user_type = req.query.user_type;
    }

    if (req.query.is_active !== undefined) {
      where.is_active = req.query.is_active === "true";
    }

    const settings = await CommissionSetting.findAll({
      where,
      include: [
        {
          model: User,
          as: "creator",
          attributes: ["user_id", "mobile_number", "role"],
        },
      ],
      order: [["created_at", "DESC"]],
    });

    return res.json({ success: true, data: settings });
  } catch (err) {
    console.error("getAllCommissionSettings:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── 2. Get Single Commission Setting ────────────────────────────────────────

/**
 * GET /admin/commission/:id
 */
exports.getCommissionSettingById = async (req, res) => {
  try {
    const setting = await CommissionSetting.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: "creator",
          attributes: ["user_id", "mobile_number", "role"],
        },
      ],
    });

    if (!setting) {
      return res.status(404).json({ success: false, message: "Commission setting not found" });
    }

    return res.json({ success: true, data: setting });
  } catch (err) {
    console.error("getCommissionSettingById:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── 3. Create Commission Setting ────────────────────────────────────────────

/**
 * POST /admin/commission
 */
exports.createCommissionSetting = async (req, res) => {
  try {
    const {
      user_type,
      commission_type,
      commission_value,
      minimum_transaction_amount,
      maximum_commission_amount,
      effective_from,
      effective_to,
      description,
    } = req.body;

    // ── Validation ──
    if (!user_type || !commission_type || commission_value === undefined || !effective_from) {
      return res.status(400).json({
        success: false,
        message: "user_type, commission_type, commission_value, and effective_from are required",
      });
    }

    if (!VALID_USER_TYPES.includes(user_type)) {
      return res.status(400).json({
        success: false,
        message: `Invalid user_type. Must be one of: ${VALID_USER_TYPES.join(", ")}`,
      });
    }

    if (!VALID_COMMISSION_TYPES.includes(commission_type)) {
      return res.status(400).json({
        success: false,
        message: `Invalid commission_type. Must be one of: ${VALID_COMMISSION_TYPES.join(", ")}`,
      });
    }

    if (Number(commission_value) < 0) {
      return res.status(400).json({ success: false, message: "commission_value must be non-negative" });
    }

    if (commission_type === "percentage" && Number(commission_value) > 100) {
      return res.status(400).json({ success: false, message: "Percentage commission_value cannot exceed 100" });
    }

    if (effective_to && new Date(effective_to) <= new Date(effective_from)) {
      return res.status(400).json({ success: false, message: "effective_to must be after effective_from" });
    }

    const setting = await CommissionSetting.create({
      user_type,
      commission_type,
      commission_value,
      minimum_transaction_amount: minimum_transaction_amount ?? 0,
      maximum_commission_amount:  maximum_commission_amount  ?? null,
      is_active:      true,
      effective_from,
      effective_to:   effective_to ?? null,
      description:    description  ?? null,
      created_by:     req.user?.user_id ?? null,   // from auth middleware
    });

    return res.status(201).json({
      success: true,
      message: "Commission setting created successfully",
      data: setting,
    });
  } catch (err) {
    console.error("createCommissionSetting:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── 4. Update Commission Setting ────────────────────────────────────────────

/**
 * PUT /admin/commission/:id
 */
exports.updateCommissionSetting = async (req, res) => {
  try {
    const setting = await CommissionSetting.findByPk(req.params.id);

    if (!setting) {
      return res.status(404).json({ success: false, message: "Commission setting not found" });
    }

    const {
      user_type,
      commission_type,
      commission_value,
      minimum_transaction_amount,
      maximum_commission_amount,
      is_active,
      effective_from,
      effective_to,
      description,
    } = req.body;

    // ── Validation ──
    if (user_type && !VALID_USER_TYPES.includes(user_type)) {
      return res.status(400).json({
        success: false,
        message: `Invalid user_type. Must be one of: ${VALID_USER_TYPES.join(", ")}`,
      });
    }

    if (commission_type && !VALID_COMMISSION_TYPES.includes(commission_type)) {
      return res.status(400).json({
        success: false,
        message: `Invalid commission_type. Must be one of: ${VALID_COMMISSION_TYPES.join(", ")}`,
      });
    }

    if (commission_value !== undefined && Number(commission_value) < 0) {
      return res.status(400).json({ success: false, message: "commission_value must be non-negative" });
    }

    const resolvedType  = commission_type  ?? setting.commission_type;
    const resolvedValue = commission_value ?? setting.commission_value;

    if (resolvedType === "percentage" && Number(resolvedValue) > 100) {
      return res.status(400).json({ success: false, message: "Percentage commission_value cannot exceed 100" });
    }

    const resolvedFrom = effective_from ?? setting.effective_from;
    const resolvedTo   = effective_to   ?? setting.effective_to;

    if (resolvedTo && new Date(resolvedTo) <= new Date(resolvedFrom)) {
      return res.status(400).json({ success: false, message: "effective_to must be after effective_from" });
    }

    await setting.update({
      ...(user_type                  !== undefined && { user_type }),
      ...(commission_type            !== undefined && { commission_type }),
      ...(commission_value           !== undefined && { commission_value }),
      ...(minimum_transaction_amount !== undefined && { minimum_transaction_amount }),
      ...(maximum_commission_amount  !== undefined && { maximum_commission_amount }),
      ...(is_active                  !== undefined && { is_active }),
      ...(effective_from             !== undefined && { effective_from }),
      ...(effective_to               !== undefined && { effective_to }),
      ...(description                !== undefined && { description }),
    });

    return res.json({
      success: true,
      message: "Commission setting updated successfully",
      data: setting,
    });
  } catch (err) {
    console.error("updateCommissionSetting:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── 5. Deactivate Commission Setting (Soft Delete) ──────────────────────────

/**
 * DELETE /admin/commission/:id
 * Soft delete — sets is_active = false.
 */
exports.deactivateCommissionSetting = async (req, res) => {
  try {
    const setting = await CommissionSetting.findByPk(req.params.id);

    if (!setting) {
      return res.status(404).json({ success: false, message: "Commission setting not found" });
    }

    if (!setting.is_active) {
      return res.status(400).json({ success: false, message: "Commission setting is already inactive" });
    }

    await setting.update({ is_active: false });

    return res.json({
      success: true,
      message: "Commission setting deactivated successfully",
    });
  } catch (err) {
    console.error("deactivateCommissionSetting:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};