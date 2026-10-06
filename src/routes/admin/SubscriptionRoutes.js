const router = require("express").Router();
const ctrl = require("../../controllers/admin/SubscriptionController");
const { verifyAdminToken } = require("../../middleware/adminAuth");

// All subscription routes are protected
router.use(verifyAdminToken);

/**
 * @swagger
 * tags:
 *   name: Admin Subscriptions
 *   description: Admin - Farmer Subscription Management
 */

/**
 * @swagger
 * /admin/subscriptions:
 *   get:
 *     summary: List all farmer subscriptions — plan, duration, status, expiry
 *     tags: [Admin Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, example: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, example: 20 }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [pending, active, expired, cancelled, flagged] }
 *       - in: query
 *         name: plan_type
 *         schema: { type: string, enum: [basic, premium] }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Search by farmer name
 *       - in: query
 *         name: sort_by
 *         schema: { type: string, enum: [created_at, expiry_date, start_date] }
 *       - in: query
 *         name: order
 *         schema: { type: string, enum: [asc, desc] }
 *     responses:
 *       200:
 *         description: Subscriptions list fetched successfully
 */
router.get("/", ctrl.listSubscriptions);

/**
 * @swagger
 * /admin/subscriptions/{subscription_id}:
 *   get:
 *     summary: Get full subscription detail incl. payment trail
 *     tags: [Admin Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: subscription_id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Subscription detail
 *       404:
 *         description: Subscription not found
 */
router.get("/:subscription_id", ctrl.getSubscriptionById);

/**
 * @swagger
 * /admin/subscriptions/{subscription_id}/verify:
 *   patch:
 *     summary: Manually verify/activate a subscription (payment disputes, failed webhooks, edge cases)
 *     tags: [Admin Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: subscription_id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               admin_note: { type: string }
 *     responses:
 *       200:
 *         description: Subscription manually verified and activated
 *       404:
 *         description: Subscription not found
 */
router.patch("/:subscription_id/verify", ctrl.verifySubscription);

/**
 * @swagger
 * /admin/subscriptions/{subscription_id}/flag:
 *   patch:
 *     summary: Flag a subscription (payment dispute / suspicious activity) — blocks farmer app access
 *     tags: [Admin Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: subscription_id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [admin_note]
 *             properties:
 *               admin_note: { type: string }
 *     responses:
 *       200:
 *         description: Subscription flagged
 *       400:
 *         description: admin_note is required
 *       404:
 *         description: Subscription not found
 */
router.patch("/:subscription_id/flag", ctrl.flagSubscription);

/**
 * @swagger
 * /admin/subscriptions/{subscription_id}/unflag:
 *   patch:
 *     summary: Clear a flag on a subscription (re-evaluates status by live expiry)
 *     tags: [Admin Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: subscription_id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Subscription unflagged
 *       404:
 *         description: Subscription not found
 *       409:
 *         description: Subscription is not currently flagged
 */
router.patch("/:subscription_id/unflag", ctrl.unflagSubscription);

module.exports = router;