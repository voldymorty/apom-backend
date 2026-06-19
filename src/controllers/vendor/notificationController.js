"use strict";

const { Notification, User } = require("../../models");
const { Op } = require("sequelize");

// ─── GET /vendor/notifications ────────────────────────────────────────────────
// Query: page, limit, type, is_read
exports.getNotifications = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;

    const where = { user_id: req.user.user_id };

    if (req.query.type) {
      where.notification_type = req.query.type;
    }

    if (req.query.is_read !== undefined) {
      where.is_read = req.query.is_read === "true";
    }

    const { count, rows } = await Notification.findAndCountAll({
      where,
      order: [["created_at", "DESC"]],
      limit,
      offset,
    });

    return res.json({
      success: true,
      data: {
        notifications: rows.map(formatNotification),
        pagination: {
          total: count,
          page,
          limit,
          total_pages: Math.ceil(count / limit),
        },
      },
    });
  } catch (err) {
    console.error("getNotifications:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── GET /vendor/notifications/unread-count ───────────────────────────────────
exports.getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.count({
      where: { user_id: req.user.user_id, is_read: false },
    });

    return res.json({
      success: true,
      data: { unread_count: count },
    });
  } catch (err) {
    console.error("getUnreadCount:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── PUT /vendor/notifications/:id/read ───────────────────────────────────────
exports.markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findOne({
      where: {
        notification_id: req.params.id,
        user_id: req.user.user_id,
      },
    });

    if (!notification) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }

    if (!notification.is_read) {
      await notification.update({ is_read: true, read_at: new Date() });
    }

    return res.json({ success: true, message: "Notification marked as read" });
  } catch (err) {
    console.error("markAsRead:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── PUT /vendor/notifications/read-all ───────────────────────────────────────
exports.markAllAsRead = async (req, res) => {
  try {
    const [updatedCount] = await Notification.update(
      { is_read: true, read_at: new Date() },
      { where: { user_id: req.user.user_id, is_read: false } }
    );

    return res.json({
      success: true,
      message: `${updatedCount} notification(s) marked as read`,
      data: { updated_count: updatedCount },
    });
  } catch (err) {
    console.error("markAllAsRead:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── Helper ───────────────────────────────────────────────────────────────────
function formatNotification(n) {
  return {
    notification_id: n.notification_id,
    type: n.notification_type,
    title: n.title,
    message: n.message,
    reference_type: n.reference_type,
    reference_id: n.reference_id,
    action_url: n.action_url,
    is_read: n.is_read,
    read_at: n.read_at,
    priority: n.priority,
    created_at: n.created_at,
  };
}