"use strict";

const { Notification, User } = require("../../models");
const { Op }                 = require("sequelize");
const admin                  = require("../../config/firebase");   // Firebase Admin SDK instance

const VALID_TYPES      = ["order", "delivery", "payment", "approval", "general", "earning", "alert"];
const VALID_PRIORITIES = ["low", "medium", "high", "urgent"];
const VALID_REF_TYPES  = ["order", "delivery", "payment", "crop", "earning", "user"];
const VALID_ROLES      = ["farmer", "vendor", "delivery"];

// ─── Internal: fire FCM to one or many tokens ─────────────────────────────────
async function sendFCM({ tokens, title, body, data = {} }) {
  if (!tokens || tokens.length === 0) return { successCount: 0, failureCount: 0 };

  // Filter out null/empty tokens
  const validTokens = tokens.filter(Boolean);
  if (validTokens.length === 0) return { successCount: 0, failureCount: 0 };

  const message = {
    notification: { title, body },
    data:         { ...data, click_action: "FLUTTER_NOTIFICATION_CLICK" },
    tokens:       validTokens,
  };

  try {
    const response = await admin.messaging().sendEachForMulticast(message);
    return {
      successCount: response.successCount,
      failureCount: response.failureCount,
    };
  } catch (fcmErr) {
    console.error("FCM error:", fcmErr);
    return { successCount: 0, failureCount: validTokens.length };
  }
}

// ─── 1. List Notifications ────────────────────────────────────────────────────

/**
 * GET /admin/notifications
 * Filters: user_id, notification_type, is_read, priority, from, to
 */
exports.getNotifications = async (req, res) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;

    const where = {};

    if (req.query.user_id) {
      const uid = parseInt(req.query.user_id);
      if (isNaN(uid)) {
        return res.status(400).json({ success: false, message: "user_id must be an integer" });
      }
      where.user_id = uid;
    }

    if (req.query.notification_type) {
      if (!VALID_TYPES.includes(req.query.notification_type)) {
        return res.status(400).json({
          success: false,
          message: `Invalid notification_type. Must be one of: ${VALID_TYPES.join(", ")}`,
        });
      }
      where.notification_type = req.query.notification_type;
    }

    if (req.query.is_read !== undefined) {
      where.is_read = req.query.is_read === "true";
    }

    if (req.query.priority) {
      if (!VALID_PRIORITIES.includes(req.query.priority)) {
        return res.status(400).json({
          success: false,
          message: `Invalid priority. Must be one of: ${VALID_PRIORITIES.join(", ")}`,
        });
      }
      where.priority = req.query.priority;
    }

    if (req.query.from || req.query.to) {
      where.created_at = {};
      if (req.query.from) where.created_at[Op.gte] = new Date(req.query.from);
      if (req.query.to)   where.created_at[Op.lte] = new Date(`${req.query.to}T23:59:59`);
    }

    const { count, rows } = await Notification.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: "user",
          attributes: ["user_id", "mobile_number", "role"],
        },
      ],
      order:  [["created_at", "DESC"]],
      limit,
      offset,
    });

    return res.json({
      success: true,
      data: {
        notifications: rows,
        pagination: {
          total:       count,
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

// ─── 2. Get Single Notification ───────────────────────────────────────────────

/**
 * GET /admin/notifications/:id
 */
exports.getNotificationById = async (req, res) => {
  try {
    const notification = await Notification.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: "user",
          attributes: ["user_id", "mobile_number", "role"],
        },
      ],
    });

    if (!notification) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }

    return res.json({ success: true, data: notification });
  } catch (err) {
    console.error("getNotificationById:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── 3. Send Notification ─────────────────────────────────────────────────────

/**
 * POST /admin/notifications/send
 *
 * Target options (pick one):
 *   - user_id               → single user
 *   - role                  → all users of that role (farmer | vendor | delivery)
 *   - target: "all"         → every active user
 */
exports.sendNotification = async (req, res) => {
  try {
    const {
      target,         // "all"
      user_id,        // single user
      role,           // role broadcast
      notification_type,
      title,
      message,
      reference_type,
      reference_id,
      action_url,
      priority,
      send_push,
    } = req.body;

    // ── Required fields ──
    if (!notification_type || !title || !message) {
      return res.status(400).json({
        success: false,
        message: "notification_type, title, and message are required",
      });
    }

    if (!VALID_TYPES.includes(notification_type)) {
      return res.status(400).json({
        success: false,
        message: `Invalid notification_type. Must be one of: ${VALID_TYPES.join(", ")}`,
      });
    }

    if (priority && !VALID_PRIORITIES.includes(priority)) {
      return res.status(400).json({
        success: false,
        message: `Invalid priority. Must be one of: ${VALID_PRIORITIES.join(", ")}`,
      });
    }

    if (reference_type && !VALID_REF_TYPES.includes(reference_type)) {
      return res.status(400).json({
        success: false,
        message: `Invalid reference_type. Must be one of: ${VALID_REF_TYPES.join(", ")}`,
      });
    }

    // ── Resolve target users ──
    let userWhere = { is_active: true };

    if (user_id) {
      // Single user
      const uid = parseInt(user_id);
      if (isNaN(uid)) {
        return res.status(400).json({ success: false, message: "user_id must be an integer" });
      }
      userWhere.user_id = uid;
    } else if (role) {
      // Role broadcast
      if (!VALID_ROLES.includes(role)) {
        return res.status(400).json({
          success: false,
          message: `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}`,
        });
      }
      userWhere.role = role;
    } else if (target === "all") {
      // All active non-admin users
      userWhere.role = { [Op.in]: VALID_ROLES };
    } else {
      return res.status(400).json({
        success: false,
        message: "Provide one of: user_id, role, or target: 'all'",
      });
    }

    const users = await User.findAll({
      where: userWhere,
      attributes: ["user_id", "fcm_token"],
    });

    if (users.length === 0) {
      return res.status(404).json({ success: false, message: "No matching users found" });
    }

    const shouldPush = send_push !== false;  // defaults true

    // ── Bulk insert notifications ──
    const notificationRows = users.map((u) => ({
      user_id:           u.user_id,
      notification_type,
      title,
      message,
      reference_type:    reference_type ?? null,
      reference_id:      reference_id   ?? null,
      action_url:        action_url     ?? null,
      is_read:           false,
      priority:          priority       ?? "medium",
      send_push:         shouldPush,
      push_sent_at:      null,
      created_at:        new Date(),
    }));

    await Notification.bulkCreate(notificationRows);

    // ── Fire FCM ──
    let fcmResult = { successCount: 0, failureCount: 0 };

    if (shouldPush) {
      const tokens = users.map((u) => u.fcm_token).filter(Boolean);
      fcmResult = await sendFCM({
        tokens,
        title,
        body: message,
        data: {
          notification_type,
          ...(reference_type && { reference_type }),
          ...(reference_id   && { reference_id: String(reference_id) }),
        },
      });

      // Stamp push_sent_at for successfully sent records
      if (fcmResult.successCount > 0) {
        await Notification.update(
          { push_sent_at: new Date() },
          {
            where: {
              user_id:    { [Op.in]: users.map((u) => u.user_id) },
              push_sent_at: null,
              send_push:  true,
            },
          }
        );
      }
    }

    return res.status(201).json({
      success: true,
      message: `Notification sent to ${users.length} user(s)`,
      data: {
        total_recipients:   users.length,
        fcm_success:        fcmResult.successCount,
        fcm_failed:         fcmResult.failureCount,
        push_attempted:     shouldPush,
      },
    });
  } catch (err) {
    console.error("sendNotification:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── 4. Mark Single Notification as Read ─────────────────────────────────────

/**
 * PUT /admin/notifications/:id/mark-read
 */
exports.markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findByPk(req.params.id);

    if (!notification) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }

    if (notification.is_read) {
      return res.status(400).json({ success: false, message: "Notification is already marked as read" });
    }

    await notification.update({ is_read: true, read_at: new Date() });

    return res.json({ success: true, message: "Notification marked as read" });
  } catch (err) {
    console.error("markAsRead:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── 5. Mark All as Read (for a user) ────────────────────────────────────────

/**
 * PUT /admin/notifications/mark-all-read
 * Body: { user_id }
 */
exports.markAllAsRead = async (req, res) => {
  try {
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ success: false, message: "user_id is required" });
    }

    const uid = parseInt(user_id);
    if (isNaN(uid)) {
      return res.status(400).json({ success: false, message: "user_id must be an integer" });
    }

    const userExists = await User.findByPk(uid, { attributes: ["user_id"] });
    if (!userExists) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const [updatedCount] = await Notification.update(
      { is_read: true, read_at: new Date() },
      { where: { user_id: uid, is_read: false } }
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