"use strict";

const admin = require("../config/firebase");
const Notification = require("../models/notification");
const User = require("../models/user");
const { Op } = require("sequelize");

// ─── Internal: fire FCM to one or many tokens ─────────────────────────────────
async function fireFCM({ tokens, title, body, data = {} }) {
  if (!tokens || tokens.length === 0) {
    return { successCount: 0, failureCount: 0 };
  }

  const validTokens = tokens.filter(Boolean);
  if (validTokens.length === 0) {
    return { successCount: 0, failureCount: 0 };
  }

  // Stringify all data values (FCM data payload requires string values)
  const stringData = {};
  for (const [key, value] of Object.entries(data)) {
    stringData[key] = String(value);
  }

  // Always include click_action for Flutter
  stringData.click_action = "FLUTTER_NOTIFICATION_CLICK";

  const message = {
    notification: { title, body },
    android: {
      notification: {
        channelId: "high_importance_channel",
        priority: "high",
      },
    },
    apns: {
      payload: {
        aps: {
          sound: "default",
        },
      },
    },
    data: stringData,
    tokens: validTokens,
  };

  try {
    const response = await admin.messaging().sendEachForMulticast(message);
    return {
      successCount: response.successCount,
      failureCount: response.failureCount,
    };
  } catch (fcmErr) {
    console.error("🔔 FCM send error:", fcmErr.message);
    return { successCount: 0, failureCount: validTokens.length };
  }
}

// ─── Public: send notification to one or more users ───────────────────────────

/**
 * Send a notification — stores in DB + optionally fires FCM push.
 *
 * @param {Object}   opts
 * @param {number}   [opts.userId]           – single recipient user_id
 * @param {number[]} [opts.userIds]          – multiple recipient user_ids
 * @param {string}   opts.type               – notification_type enum value
 * @param {string}   opts.title              – notification title
 * @param {string}   opts.message            – notification body text
 * @param {string}   [opts.referenceType]    – 'order' | 'delivery' | 'payment' | etc.
 * @param {number}   [opts.referenceId]      – ID of the referenced entity
 * @param {string}   [opts.actionUrl]        – deep-link or screen route
 * @param {string}   [opts.priority='medium'] – 'low' | 'medium' | 'high' | 'urgent'
 * @param {boolean}  [opts.sendPush=true]    – whether to fire FCM
 * @param {Object}   [opts.fcmData={}]       – extra key-value pairs for FCM data payload
 *
 * @returns {Promise<{ notificationIds: number[], fcmResult: { successCount, failureCount } }>}
 */
async function sendNotification(opts) {
  const {
    userId,
    userIds,
    type,
    title,
    message,
    referenceType = null,
    referenceId = null,
    actionUrl = null,
    priority = "medium",
    sendPush = true,
    fcmData = {},
  } = opts;

  // ── Resolve target user IDs ──
  let targetIds = [];
  if (userId) {
    targetIds = [userId];
  } else if (userIds && userIds.length > 0) {
    targetIds = [...new Set(userIds)]; // deduplicate
  }

  if (targetIds.length === 0) {
    console.warn("🔔 sendNotification called with no target users");
    return { notificationIds: [], fcmResult: { successCount: 0, failureCount: 0 } };
  }

  // ── Bulk insert notifications into DB ──
  const now = new Date();
  const notificationRows = targetIds.map((uid) => ({
    user_id: uid,
    notification_type: type,
    title,
    message,
    reference_type: referenceType,
    reference_id: referenceId,
    action_url: actionUrl,
    is_read: false,
    priority,
    send_push: sendPush,
    push_sent_at: null,
    created_at: now,
  }));

  const created = await Notification.bulkCreate(notificationRows);
  const notificationIds = created.map((n) => n.notification_id);

  // ── Fire FCM push if enabled ──
  let fcmResult = { successCount: 0, failureCount: 0 };

  if (sendPush) {
    // Fetch FCM tokens for target users
    const users = await User.findAll({
      where: { user_id: { [Op.in]: targetIds }, is_active: true },
      attributes: ["user_id", "fcm_token"],
    });

    const tokens = users.map((u) => u.fcm_token).filter(Boolean);

    if (tokens.length > 0) {
      fcmResult = await fireFCM({
        tokens,
        title,
        body: message,
        data: {
          notification_type: type,
          ...(referenceType && { reference_type: referenceType }),
          ...(referenceId && { reference_id: String(referenceId) }),
          ...fcmData,
        },
      });

      // Stamp push_sent_at for sent notifications
      if (fcmResult.successCount > 0) {
        await Notification.update(
          { push_sent_at: new Date() },
          {
            where: {
              notification_id: { [Op.in]: notificationIds },
              send_push: true,
              push_sent_at: null,
            },
          }
        );
      }
    }
  }

  console.log(
    `🔔 Notification sent: "${title}" → ${targetIds.length} user(s), ` +
    `FCM: ${fcmResult.successCount}✓ ${fcmResult.failureCount}✗`
  );

  return { notificationIds, fcmResult };
}

/**
 * Automatically sends notifications to relevant users on task status transitions.
 *
 * @param {Object} task - the PickupDelivery instance
 * @param {string} newStatus - the new status ('accepted', 'in_transit', 'reached', 'completed', 'cancelled')
 */
async function notifyStatusChange(task, newStatus) {
  try {
    const User = require("../models/user");
    const Farmer = require("../models/farmer");
    const Vendor = require("../models/vendor");
    const Order = require("../models/order");
    const DeliveryPersonnel = require("../models/deliveryPersonnel");

    // Fetch driver name for messages
    let driverName = "Driver";
    if (task.delivery_person_id) {
      const dp = await DeliveryPersonnel.findByPk(task.delivery_person_id);
      if (dp) driverName = dp.full_name;
    }

    if (task.delivery_type === "pickup") {
      if (!task.farmer_id) return;
      const farmer = await Farmer.findByPk(task.farmer_id);
      if (!farmer || !farmer.user_id) return;

      let title = "";
      let message = "";

      switch (newStatus) {
        case "accepted":
          title = "✅ Pickup Accepted";
          message = `Driver ${driverName} has accepted your pickup request.`;
          break;
        case "in_transit":
          title = "🚚 Driver En Route";
          message = `Driver ${driverName} is on the way to pick up your crop.`;
          break;
        case "reached":
          title = "📍 Driver Arrived";
          message = `Driver ${driverName} has arrived at your location.`;
          break;
        case "completed":
          title = "📦 Crop Picked Up";
          message = `Your crop has been picked up by ${driverName}. Procurement details are pending admin review.`;
          break;
        case "cancelled":
          title = "❌ Pickup Cancelled";
          message = `Your scheduled pickup task has been cancelled.`;
          break;
        default:
          return; // No notification for other statuses
      }

      await sendNotification({
        userId: farmer.user_id,
        type: "order",
        title,
        message,
        referenceType: "crop",
        referenceId: task.crop_id,
        priority: "medium",
        fcmData: {
          screen: "pickup",
          crop_id: String(task.crop_id),
        },
      });
    } else if (task.delivery_type === "delivery") {
      if (!task.vendor_id) return;
      const vendor = await Vendor.findByPk(task.vendor_id);
      if (!vendor || !vendor.user_id) return;

      let orderNumber = "order";
      if (task.order_id) {
        const order = await Order.findByPk(task.order_id);
        if (order) orderNumber = `#${order.order_number}`;
      }

      let title = "";
      let message = "";

      switch (newStatus) {
        case "accepted":
          title = "✅ Delivery Accepted";
          message = `Driver ${driverName} has accepted the delivery for order ${orderNumber}.`;
          break;
        case "in_transit":
          title = "🚚 Order Dispatched";
          message = `Your order ${orderNumber} has been dispatched by ${driverName} and is on the way.`;
          break;
        case "reached":
          title = "📍 Driver Arrived";
          message = `Driver ${driverName} has arrived with your order ${orderNumber}.`;
          break;
        case "completed":
          title = "🎉 Order Delivered";
          message = `Your order ${orderNumber} has been successfully delivered by ${driverName}.`;
          break;
        case "cancelled":
          title = "❌ Delivery Cancelled";
          message = `The delivery for order ${orderNumber} has been cancelled.`;
          break;
        default:
          return;
      }

      await sendNotification({
        userId: vendor.user_id,
        type: "order",
        title,
        message,
        referenceType: "order",
        referenceId: task.order_id,
        priority: "high",
        fcmData: {
          screen: "order_detail",
          order_id: String(task.order_id),
        },
      });
    }

    // If driver is assigned and task is cancelled, notify driver as well
    if (newStatus === "cancelled" && task.delivery_person_id) {
      const dp = await DeliveryPersonnel.findByPk(task.delivery_person_id);
      if (dp && dp.user_id) {
        await sendNotification({
          userId: dp.user_id,
          type: "delivery",
          title: "❌ Task Cancelled",
          message: `The ${task.delivery_type} task ${task.delivery_number} has been cancelled.`,
          referenceType: "delivery",
          referenceId: task.delivery_id,
          priority: "high",
          fcmData: {
            screen: task.delivery_type === "delivery" ? "delivery_detail" : "pickup_detail",
            task_id: String(task.delivery_id),
          },
        });
      }
    }
  } catch (err) {
    console.error("🔔 Error in notifyStatusChange:", err);
  }
}

module.exports = { sendNotification, notifyStatusChange };
