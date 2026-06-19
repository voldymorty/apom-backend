const router = require("express").Router();
const ctrl   = require("../../controllers/delivery/routeController");
const { authenticate, authorizeRoles } = require("../../middleware/auth");

const guard = [authenticate, authorizeRoles("delivery")];

/**
 * @swagger
 * tags:
 *   name: Delivery Routes
 *   description: |
 *     Daily route plans for a driver. Each route contains an ordered list of
 *     task stops (both pickups and deliveries) for the day, plus an
 *     `optimized_waypoints` JSON array for map rendering in the Flutter app.
 */

/**
 * @swagger
 * /delivery/routes:
 *   get:
 *     summary: Get route plan(s) for a given day with all embedded stops
 *     tags: [Delivery Routes]
 *     description: |
 *       Defaults to today. Returns routes with their task stops ordered by
 *       `scheduled_time_slot ASC` then `delivery_type ASC` (pickups before
 *       deliveries in the same slot — matching the app's tab order).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: date
 *         schema: { type: string, format: date, example: "2025-06-10" }
 *         description: Defaults to today's date
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [planned, in_progress, completed, cancelled]
 *     responses:
 *       200:
 *         description: Array of routes, each with task_summary and tasks array
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 total:   { type: integer }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       route_id:            { type: integer }
 *                       route_name:          { type: string }
 *                       route_date:          { type: string, format: date }
 *                       status:              { type: string }
 *                       total_stops:         { type: integer }
 *                       completed_stops:     { type: integer }
 *                       total_distance_km:   { type: number, nullable: true }
 *                       estimated_time_hours: { type: number, nullable: true }
 *                       start_time:          { type: string, format: date-time, nullable: true }
 *                       end_time:            { type: string, format: date-time, nullable: true }
 *                       optimized_waypoints: { type: array, nullable: true }
 *                       task_summary:
 *                         type: object
 *                         properties:
 *                           total:      { type: integer }
 *                           pickups:    { type: integer }
 *                           deliveries: { type: integer }
 *                           completed:  { type: integer }
 *                           pending:    { type: integer }
 *                       tasks:
 *                         type: array
 *                         description: Ordered task stops for this route
 */
router.get("/", ...guard, ctrl.getRoutes);

/**
 * @swagger
 * /delivery/routes/{route_id}:
 *   get:
 *     summary: Full route detail with all stops and optimised waypoints
 *     tags: [Delivery Routes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: route_id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Route with task_summary and full task list
 *       404:
 *         description: Route not found
 */
router.get("/:route_id", ...guard, ctrl.getRouteById);

/**
 * @swagger
 * /delivery/routes/{route_id}/start:
 *   patch:
 *     summary: Start a planned route (driver taps "Begin Route")
 *     tags: [Delivery Routes]
 *     description: |
 *       - Sets route `status` to `in_progress` and stamps `start_time`.
 *       - Marks the driver as unavailable (`is_available = false`).
 *       - Only works on routes with `status = planned`.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: route_id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Route started
 *       404:
 *         description: Route not found or already started
 */
router.patch("/:route_id/start", ...guard, ctrl.startRoute);

/**
 * @swagger
 * /delivery/routes/{route_id}/complete:
 *   patch:
 *     summary: Complete a route (all stops finished)
 *     tags: [Delivery Routes]
 *     description: |
 *       - Sets route `status` to `completed` and stamps `end_time`.
 *       - Recounts `completed_stops` from actual task statuses.
 *       - Marks the driver as available again (`is_available = true`).
 *       - Only works on routes with `status = in_progress`.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: route_id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Route completed
 *       404:
 *         description: Route not found or not in progress
 */
router.patch("/:route_id/complete", ...guard, ctrl.completeRoute);

/**
 * @swagger
 * /delivery/routes/{route_id}/cancel:
 *   patch:
 *     summary: Cancel a planned or in-progress route
 *     tags: [Delivery Routes]
 *     description: |
 *       - Sets route `status` to `cancelled` and stamps `end_time`.
 *       - If the route was in_progress, marks the driver available again.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: route_id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Route cancelled
 *       404:
 *         description: Route not found or already completed/cancelled
 */
router.patch("/:route_id/cancel", ...guard, ctrl.cancelRoute);

module.exports = router;