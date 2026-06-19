// src/routes/delivery/homeRoutes.js
const router = require("express").Router();
const ctrl = require("../../controllers/delivery/homeController");
const { authenticate, authorizeRoles } = require("../../middleware/auth");

const guard = [authenticate, authorizeRoles("delivery")];

/**
 * @swagger
 * tags:
 *   - name: Delivery Home
 *     description: Home screen stats and next task
 *   - name: Delivery Dashboard
 *     description: Delivery analytics and summary stats
 *   - name: Delivery Analytics
 *     description: Weekly performance and analytics
 */

/**
 * @swagger
 * /delivery/home:
 *   get:
 *     summary: Get home screen data (today's stats + next pending task)
 *     tags: [Delivery Home]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Delivery person info, today's pickup/delivery counts, and next task
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     delivery_person:
 *                       type: object
 *                       properties:
 *                         full_name:         { type: string }
 *                         vehicle_number:    { type: string }
 *                         vehicle_type:      { type: string }
 *                         rating:            { type: number }
 *                         is_available:      { type: boolean }
 *                         profile_photo_url: { type: string, nullable: true }
 *                     today_stats:
 *                       type: object
 *                       properties:
 *                         pickups:
 *                           type: object
 *                           properties:
 *                             completed: { type: integer }
 *                             total:     { type: integer }
 *                         deliveries:
 *                           type: object
 *                           properties:
 *                             completed: { type: integer }
 *                             total:     { type: integer }
 *                     next_task:
 *                       nullable: true
 *                       type: object
 *                       properties:
 *                         delivery_id:       { type: integer }
 *                         delivery_type:     { type: string, enum: [pickup, delivery] }
 *                         status:            { type: string }
 *                         scheduled_date:    { type: string, format: date }
 *                         scheduled_time_slot: { type: string }
 *                         pickup_address:    { type: string }
 *                         delivery_address:  { type: string }
 *                         farmer:
 *                           nullable: true
 *                           type: object
 *                           properties:
 *                             full_name:        { type: string }
 *                             location_address: { type: string }
 *                         vendor:
 *                           nullable: true
 *                           type: object
 *                           properties:
 *                             shop_name:  { type: string }
 *                             owner_name: { type: string }
 *                         crop:
 *                           nullable: true
 *                           type: object
 *                           properties:
 *                             product:
 *                               type: object
 *                               properties:
 *                                 product_name: { type: string }
 *       404:
 *         description: Delivery profile not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: false }
 *                 message: { type: string }
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: false }
 *                 message: { type: string }
 */
router.get("/", ...guard, ctrl.getHome);

/**
 * @swagger
 * /delivery/home/dashboard-summary:
 *   get:
 *     summary: Get delivery dashboard summary (monthly + current status)
 *     tags: [Delivery Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard summary counts with pickup/delivery split
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     completed:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                           example: 100
 *                         pickups:
 *                           type: integer
 *                           example: 20
 *                         deliveries:
 *                           type: integer
 *                           example: 80
 *                     in_progress:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                           example: 10
 *                         pickups:
 *                           type: integer
 *                           example: 3
 *                         deliveries:
 *                           type: integer
 *                           example: 7
 *                     pending:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                           example: 6
 *                         pickups:
 *                           type: integer
 *                           example: 2
 *                         deliveries:
 *                           type: integer
 *                           example: 4
 *                     upcoming:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                           example: 12
 *                         pickups:
 *                           type: integer
 *                           example: 5
 *                         deliveries:
 *                           type: integer
 *                           example: 7
 *       404:
 *         description: Delivery profile not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *       500:
 *         description: Server error
 */
router.get("/dashboard-summary", ...guard, ctrl.getDashboardSummary);

/**
 * @swagger
 * /delivery/home/weekly-performance:
 *   get:
 *     summary: Get weekly performance (Mon to Sun)
 *     description: Returns completed pickups and deliveries per day. Future days will have zero values.
 *     tags: [Delivery Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Weekly performance data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       day:
 *                         type: string
 *                         example: Mon
 *                       pickups:
 *                         type: integer
 *                         example: 3
 *                       deliveries:
 *                         type: integer
 *                         example: 5
 *       404:
 *         description: Delivery profile not found
 *       500:
 *         description: Server error
 */
router.get("/weekly-performance", ...guard, ctrl.getWeeklyPerformance);

module.exports = router;