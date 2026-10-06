const router = require("express").Router();
const ctrl = require("../../controllers/admin/SubscriptionPlanController");
const { verifyAdminToken } = require("../../middleware/adminAuth");

// All subscription plan routes are protected
router.use(verifyAdminToken);

/**
 * @swagger
 * tags:
 *   name: Admin Subscription Plans
 *   description: Admin - Farmer Subscription Pricing Catalogue
 */

/**
 * @swagger
 * /admin/subscription-plans:
 *   get:
 *     summary: List all subscription plans (active + inactive)
 *     tags: [Admin Subscription Plans]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Plans fetched successfully
 */
router.get("/", ctrl.listPlans);

/**
 * @swagger
 * /admin/subscription-plans:
 *   post:
 *     summary: Create a plan+duration price point (e.g. Basic/Monthly)
 *     tags: [Admin Subscription Plans]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [plan_type, duration, price, duration_days]
 *             properties:
 *               plan_type:     { type: string, enum: [basic, premium] }
 *               duration:      { type: string, enum: [monthly, quarterly, annual] }
 *               price:         { type: number, example: 199 }
 *               duration_days: { type: integer, example: 30 }
 *               is_active:     { type: boolean, default: true }
 *     responses:
 *       201:
 *         description: Plan created successfully
 *       400:
 *         description: Validation error
 *       409:
 *         description: A plan for that plan_type/duration already exists
 */
router.post("/", ctrl.createPlan);

/**
 * @swagger
 * /admin/subscription-plans/{plan_id}:
 *   patch:
 *     summary: Update a plan's price, duration_days, or active status
 *     tags: [Admin Subscription Plans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: plan_id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               price:         { type: number }
 *               duration_days: { type: integer }
 *               is_active:     { type: boolean }
 *     responses:
 *       200:
 *         description: Plan updated successfully
 *       400:
 *         description: Validation error
 *       404:
 *         description: Plan not found
 */
router.patch("/:plan_id", ctrl.updatePlan);

/**
 * @swagger
 * /admin/subscription-plans/{plan_id}/deactivate:
 *   patch:
 *     summary: Deactivate a plan (hides it from the farmer app; existing subscriptions unaffected)
 *     tags: [Admin Subscription Plans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: plan_id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Plan deactivated
 *       404:
 *         description: Plan not found
 */
router.patch("/:plan_id/deactivate", ctrl.deactivatePlan);

module.exports = router;