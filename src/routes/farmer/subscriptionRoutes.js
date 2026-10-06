const router = require("express").Router();
const ctrl = require("../../controllers/farmer/subscriptionController");
const { authenticate, authorizeRoles } = require("../../middleware/auth");

/**
 * @swagger
 * /farmer/subscriptions/plans:
 *   get:
 *     summary: List active subscription plans (Basic/Premium x Monthly/Quarterly/Annual)
 *     tags: [Farmer Subscription]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of active plans
 */
router.get("/plans", authenticate, authorizeRoles("farmer"), ctrl.getPlans);

/**
 * @swagger
 * /farmer/subscriptions/status:
 *   get:
 *     summary: Live subscription status for the logged-in farmer (drives the paywall UI)
 *     tags: [Farmer Subscription]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: has_access, reason (none/expired/flagged/active), and subscription details
 */
router.get("/status", authenticate, authorizeRoles("farmer"), ctrl.getStatus);

/**
 * @swagger
 * /farmer/subscriptions/initiate:
 *   post:
 *     summary: Start a subscription purchase — creates a pending subscription + Razorpay order
 *     tags: [Farmer Subscription]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [plan_id]
 *             properties:
 *               plan_id: { type: integer }
 *     responses:
 *       200:
 *         description: Razorpay order created
 *       400:
 *         description: plan_id missing
 *       404:
 *         description: Plan not found or inactive
 */
router.post("/initiate", authenticate, authorizeRoles("farmer"), ctrl.initiatePayment);

/**
 * @swagger
 * /farmer/subscriptions/verify:
 *   post:
 *     summary: Verify Razorpay payment and activate the subscription
 *     tags: [Farmer Subscription]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [subscription_id, razorpay_order_id, razorpay_payment_id, razorpay_signature]
 *             properties:
 *               subscription_id:      { type: integer }
 *               razorpay_order_id:    { type: string }
 *               razorpay_payment_id:  { type: string }
 *               razorpay_signature:   { type: string }
 *     responses:
 *       200:
 *         description: Subscription activated
 *       400:
 *         description: Invalid signature or missing fields
 */
router.post("/verify", authenticate, authorizeRoles("farmer"), ctrl.verifyPayment);

/**
 * @swagger
 * /farmer/subscriptions/failure:
 *   post:
 *     summary: Record a failed/cancelled subscription payment
 *     tags: [Farmer Subscription]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [subscription_id]
 *             properties:
 *               subscription_id: { type: integer }
 *               failure_reason:  { type: string }
 *     responses:
 *       200:
 *         description: Failure recorded
 */
router.post("/failure", authenticate, authorizeRoles("farmer"), ctrl.handlePaymentFailure);

module.exports = router;