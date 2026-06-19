"use strict";

const { AuditLog, User } = require("../../models");
const { Op } = require("sequelize");

const VALID_ACTIONS = ["create", "read", "update", "delete"];

// ─── 1. List Audit Logs ───────────────────────────────────────────────────────

/**
 * GET /admin/audit-logs
 * Filters: user_id, action_type, action, table_name, from, to
 * Pagination: page, limit
 */
exports.getAuditLogs = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;

    const where = {};

    if (req.query.user_id) {
      const uid = parseInt(req.query.user_id);
      if (isNaN(uid)) {
        return res.status(400).json({ success: false, message: "user_id must be an integer" });
      }
      where.user_id = uid;
    }

    if (req.query.action_type) {
      // partial match — e.g. "order" matches "order.created", "order.updated"
      where.action_type = { [Op.like]: `%${req.query.action_type}%` };
    }

    if (req.query.action) {
      if (!VALID_ACTIONS.includes(req.query.action)) {
        return res.status(400).json({
          success: false,
          message: `Invalid action. Must be one of: ${VALID_ACTIONS.join(", ")}`,
        });
      }
      where.action = req.query.action;
    }

    if (req.query.table_name) {
      where.table_name = req.query.table_name;
    }

    // Date range on created_at
    if (req.query.from || req.query.to) {
      where.created_at = {};
      if (req.query.from) where.created_at[Op.gte] = new Date(req.query.from);
      if (req.query.to)   where.created_at[Op.lte] = new Date(`${req.query.to}T23:59:59`);
    }

    const { count, rows } = await AuditLog.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: "user",
          attributes: ["user_id", "mobile_number", "role"],
          required: false,   // LEFT JOIN — some logs may have no user (system actions)
        },
      ],
      order:  [["created_at", "DESC"]],
      limit,
      offset,
    });

    return res.json({
      success: true,
      data: {
        logs: rows,
        pagination: {
          total:       count,
          page,
          limit,
          total_pages: Math.ceil(count / limit),
        },
      },
    });
  } catch (err) {
    console.error("getAuditLogs:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── 2. Get Single Audit Log ──────────────────────────────────────────────────

/**
 * GET /admin/audit-logs/:id
 */
exports.getAuditLogById = async (req, res) => {
  try {
    const log = await AuditLog.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: "user",
          attributes: ["user_id", "mobile_number", "role"],
          required: false,
        },
      ],
    });

    if (!log) {
      return res.status(404).json({ success: false, message: "Audit log not found" });
    }

    return res.json({ success: true, data: log });
  } catch (err) {
    console.error("getAuditLogById:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};