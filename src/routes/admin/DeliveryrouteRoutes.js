const router = require("express").Router();
const ctrl = require("../../controllers/admin/PickupdeliveryController");
const { verifyAdminToken } = require("../../middleware/adminAuth");

router.use(verifyAdminToken);

/**
 * @swagger
 * tags:
 *   name: Admin DeliveryRoutes
 *   description: Admin - Delivery Routes Management
 */

// ─────────────────────────────────────────────────────────────────────────────
// POST /admin/routes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /admin/routes:
 *   post:
 *     summary: Create a new delivery route
 *     tags: [Admin DeliveryRoutes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - route_name
 *               - route_date
 *             properties:
 *               route_name:
 *                 type: string
 *                 example: Coimbatore Morning Route
 *               delivery_person_id:
 *                 type: integer
 *                 example: 2
 *               route_date:
 *                 type: string
 *                 format: date
 *                 example: "2026-04-10"
 *               total_distance_km:
 *                 type: number
 *                 example: 45.50
 *               estimated_time_hours:
 *                 type: number
 *                 example: 3.5
 *               optimized_waypoints:
 *                 type: array
 *                 example: [{lat: 11.0168, lng: 76.9558}, {lat: 10.9317, lng: 78.1198}]
 *                 items:
 *                   type: object
 *                   properties:
 *                     lat:
 *                       type: number
 *                     lng:
 *                       type: number
 *     responses:
 *       201:
 *         description: Route created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Route created successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     route_id:
 *                       type: integer
 *                       example: 1
 *                     route_name:
 *                       type: string
 *                       example: Coimbatore Morning Route
 *                     route_date:
 *                       type: string
 *                       format: date
 *                     status:
 *                       type: string
 *                       example: planned
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Missing route_name or route_date
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Delivery personnel not found
 *       500:
 *         description: Internal server error
 */
router.post("/", ctrl.createRoute);

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/routes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /admin/routes:
 *   get:
 *     summary: List all delivery routes with filters
 *     tags: [Admin DeliveryRoutes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [planned, in_progress, completed, cancelled]
 *           example: planned
 *       - in: query
 *         name: delivery_person_id
 *         schema:
 *           type: integer
 *           example: 2
 *       - in: query
 *         name: from_date
 *         schema:
 *           type: string
 *           format: date
 *           example: "2026-04-01"
 *       - in: query
 *         name: to_date
 *         schema:
 *           type: string
 *           format: date
 *           example: "2026-04-09"
 *     responses:
 *       200:
 *         description: Routes fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Routes fetched successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     routes:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           route_id:
 *                             type: integer
 *                             example: 1
 *                           route_name:
 *                             type: string
 *                             example: Coimbatore Morning Route
 *                           route_date:
 *                             type: string
 *                             format: date
 *                           status:
 *                             type: string
 *                             example: planned
 *                           total_stops:
 *                             type: integer
 *                             example: 5
 *                           completed_stops:
 *                             type: integer
 *                             example: 0
 *                           total_distance_km:
 *                             type: number
 *                             example: 45.50
 *                           estimated_time_hours:
 *                             type: number
 *                             example: 3.5
 *                           delivery_person:
 *                             type: object
 *                             nullable: true
 *                             properties:
 *                               delivery_person_id:
 *                                 type: integer
 *                                 example: 2
 *                               full_name:
 *                                 type: string
 *                                 example: Murugan S
 *                               vehicle_type:
 *                                 type: string
 *                                 example: bike
 *                               vehicle_number:
 *                                 type: string
 *                                 example: TN33AB1234
 *                           created_at:
 *                             type: string
 *                             format: date-time
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                           example: 30
 *                         page:
 *                           type: integer
 *                           example: 1
 *                         limit:
 *                           type: integer
 *                           example: 20
 *                         total_pages:
 *                           type: integer
 *                           example: 2
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Internal server error
 */
router.get("/", ctrl.listRoutes);

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/routes/:route_id
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /admin/routes/{route_id}:
 *   get:
 *     summary: Get route detail with all stops including farmer and vendor info
 *     tags: [Admin DeliveryRoutes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: route_id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *     responses:
 *       200:
 *         description: Route fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Route fetched successfully
 *                 data:
 *                   type: object
 *                   description: Full route record with delivery_person and all stops. Each stop includes farmer/vendor/crop/order info.
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Route not found
 *       500:
 *         description: Internal server error
 */
router.get("/:route_id", ctrl.getRouteById);

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /admin/routes/:route_id
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /admin/routes/{route_id}:
 *   patch:
 *     summary: Update route details
 *     tags: [Admin DeliveryRoutes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: route_id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               route_name:
 *                 type: string
 *                 example: Coimbatore Afternoon Route
 *               delivery_person_id:
 *                 type: integer
 *                 example: 3
 *               route_date:
 *                 type: string
 *                 format: date
 *                 example: "2026-04-10"
 *               total_distance_km:
 *                 type: number
 *                 example: 50.00
 *               estimated_time_hours:
 *                 type: number
 *                 example: 4.0
 *               optimized_waypoints:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     lat:
 *                       type: number
 *                     lng:
 *                       type: number
 *               status:
 *                 type: string
 *                 enum: [planned, in_progress, completed, cancelled]
 *                 example: in_progress
 *     responses:
 *       200:
 *         description: Route updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Route updated successfully
 *       400:
 *         description: No valid fields or invalid status
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Route not found
 *       409:
 *         description: Cannot update a completed or cancelled route
 *       500:
 *         description: Internal server error
 */
router.patch("/:route_id", ctrl.updateRoute);

module.exports = router;