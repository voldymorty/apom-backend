"use strict";

const router = require("express").Router();
const ctrl   = require("../../controllers/admin/NotificationController");
const { verifyAdminToken } = require("../../middleware/adminAuth");

router.use(verifyAdminToken);

// ════════════════════════════════════════════════════════════════════════════
//  NOTIFICATIONS
// ════════════════════════════════════════════════════════════════════════════

/**
 * @swagger
 * /admin/notifications:
 *   get:
 *     summary: List all notifications
 *     description: >
 *       Returns paginated notifications.
 *       Supports filtering by user, type, read status, priority, and date range.
 *     tags: [Admin Notifications]
 *     parameters:
 *       - in: query
 *         name: user_id
 *         schema:
 *           type: integer
 *           example: 5
 *         description: Filter by recipient user
 *       - in: query
 *         name: notification_type
 *         schema:
 *           type: string
 *           enum: [order, delivery, payment, approval, general, earning, alert]
 *           example: payment
 *       - in: query
 *         name: is_read
 *         schema:
 *           type: boolean
 *           example: false
 *         description: Filter by read status
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [low, medium, high, urgent]
 *           example: high
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date
 *           example: "2025-03-01"
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date
 *           example: "2025-03-31"
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           example: 20
 *     responses:
 *       200:
 *         description: Paginated list of notifications
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     notifications:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/NotificationRecord'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         total:       { type: integer, example: 210 }
 *                         page:        { type: integer, example: 1   }
 *                         limit:       { type: integer, example: 20  }
 *                         total_pages: { type: integer, example: 11  }
 *       400:
 *         description: Invalid filter value
 *       500:
 *         description: Internal server error
 */
router.get("/", ctrl.getNotifications);

/**
 * @swagger
 * /admin/notifications/mark-all-read:
 *   put:
 *     summary: Mark all notifications as read for a user
 *     description: >
 *       Bulk-marks all unread notifications for the given user_id as read.
 *       NOTE — this route must be declared before /:id to avoid route conflict.
 *     tags: [Admin Notifications]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [user_id]
 *             properties:
 *               user_id:
 *                 type: integer
 *                 example: 5
 *     responses:
 *       200:
 *         description: All notifications marked as read
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:  { type: boolean, example: true }
 *                 message:  { type: string,  example: "12 notification(s) marked as read" }
 *                 data:
 *                   type: object
 *                   properties:
 *                     updated_count: { type: integer, example: 12 }
 *       400:
 *         description: Missing or invalid user_id
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.put("/mark-all-read", ctrl.markAllAsRead);

/**
 * @swagger
 * /admin/notifications/send:
 *   post:
 *     summary: Send a notification to a user, role, or everyone
 *     description: >
 *       Creates notification records in the DB and fires FCM push notifications
 *       via Firebase Admin SDK.
 *
 *       **Target (pick exactly one):**
 *       - `user_id` — sends to a single user
 *       - `role` — broadcasts to all active users of that role (farmer | vendor | delivery)
 *       - `target: "all"` — broadcasts to all active non-admin users
 *     tags: [Admin Notifications]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [notification_type, title, message]
 *             properties:
 *               user_id:
 *                 type: integer
 *                 example: 5
 *                 description: Send to a single user. Mutually exclusive with role and target.
 *               role:
 *                 type: string
 *                 enum: [farmer, vendor, delivery]
 *                 example: farmer
 *                 description: Broadcast to all active users of this role.
 *               target:
 *                 type: string
 *                 enum: [all]
 *                 example: all
 *                 description: Broadcast to all active non-admin users.
 *               notification_type:
 *                 type: string
 *                 enum: [order, delivery, payment, approval, general, earning, alert]
 *                 example: general
 *               title:
 *                 type: string
 *                 example: "Scheduled Maintenance"
 *               message:
 *                 type: string
 *                 example: "The app will be down for maintenance on Apr 5 from 2–4 AM."
 *               reference_type:
 *                 type: string
 *                 enum: [order, delivery, payment, crop, earning, user]
 *                 example: order
 *               reference_id:
 *                 type: integer
 *                 example: 42
 *               action_url:
 *                 type: string
 *                 example: "/orders/42"
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, urgent]
 *                 example: medium
 *               send_push:
 *                 type: boolean
 *                 example: true
 *                 description: Whether to fire FCM push. Defaults to true.
 *     responses:
 *       201:
 *         description: Notification sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string,  example: "Notification sent to 320 user(s)" }
 *                 data:
 *                   type: object
 *                   properties:
 *                     total_recipients: { type: integer, example: 320 }
 *                     fcm_success:      { type: integer, example: 315 }
 *                     fcm_failed:       { type: integer, example: 5   }
 *                     push_attempted:   { type: boolean, example: true }
 *       400:
 *         description: Validation error or missing target
 *       404:
 *         description: No matching users found
 *       500:
 *         description: Internal server error
 */
router.post("/send", ctrl.sendNotification);

/**
 * @swagger
 * /admin/notifications/{id}:
 *   get:
 *     summary: Get a single notification
 *     tags: [Admin Notifications]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 88
 *     responses:
 *       200:
 *         description: Notification detail
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   $ref: '#/components/schemas/NotificationRecord'
 *       404:
 *         description: Notification not found
 *       500:
 *         description: Internal server error
 */
router.get("/:id", ctrl.getNotificationById);

/**
 * @swagger
 * /admin/notifications/{id}/mark-read:
 *   put:
 *     summary: Mark a single notification as read
 *     tags: [Admin Notifications]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 88
 *     responses:
 *       200:
 *         description: Notification marked as read
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string,  example: "Notification marked as read" }
 *       400:
 *         description: Already marked as read
 *       404:
 *         description: Notification not found
 *       500:
 *         description: Internal server error
 */
router.put("/:id/mark-read", ctrl.markAsRead);

// ─── Shared Schema ────────────────────────────────────────────────────────────
/**
 * @swagger
 * components:
 *   schemas:
 *     NotificationRecord:
 *       type: object
 *       properties:
 *         notification_id:   { type: integer, example: 88               }
 *         user_id:           { type: integer, example: 5                }
 *         notification_type: { type: string,  example: "payment"        }
 *         title:             { type: string,  example: "Payout Released"}
 *         message:           { type: string,  example: "₹11,400 has been transferred to your bank account." }
 *         reference_type:    { type: string,  example: "earning"        }
 *         reference_id:      { type: integer, example: 7                }
 *         action_url:        { type: string,  example: "/payouts/7"     }
 *         is_read:           { type: boolean, example: false            }
 *         read_at:           { type: string,  example: null             }
 *         priority:          { type: string,  example: "high"           }
 *         send_push:         { type: boolean, example: true             }
 *         push_sent_at:      { type: string,  example: "2025-04-01T10:05:00.000Z" }
 *         created_at:        { type: string,  example: "2025-04-01T10:00:00.000Z" }
 *         user:
 *           type: object
 *           properties:
 *             user_id:       { type: integer, example: 5              }
 *             mobile_number: { type: string,  example: "9876543210"   }
 *             role:          { type: string,  example: "farmer"       }
 */

module.exports = router;