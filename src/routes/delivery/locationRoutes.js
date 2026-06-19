const router = require("express").Router();
const ctrl   = require("../../controllers/delivery/locationController");
const { authenticate, authorizeRoles } = require("../../middleware/auth");

const guard = [authenticate, authorizeRoles("delivery")];

/**
 * @swagger
 * tags:
 *   name: Delivery Location
 *   description: Real-time GPS tracking for delivery personnel
 */

/**
 * @swagger
 * /delivery/location:
 *   get:
 *     summary: Get driver's last known GPS position
 *     tags: [Delivery Location]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Last known lat/lng with timestamp
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     current_latitude:     { type: number, nullable: true }
 *                     current_longitude:    { type: number, nullable: true }
 *                     last_location_update: { type: string, format: date-time, nullable: true }
 *                     is_available:         { type: boolean }
 *       404:
 *         description: Delivery profile not found
 */
router.get("/", ...guard, ctrl.getLocation);

/**
 * @swagger
 * /delivery/location:
 *   patch:
 *     summary: Push driver's current GPS coordinates
 *     tags: [Delivery Location]
 *     description: |
 *       Called periodically by the Flutter app (e.g. every 30 s) while the driver
 *       is on an active task. Passing `delivery_id` creates a lightweight tracking
 *       ping in `delivery_status_history` so the admin can replay the driver's route.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [latitude, longitude]
 *             properties:
 *               latitude:
 *                 type: number
 *                 format: float
 *                 example: 11.0168
 *               longitude:
 *                 type: number
 *                 format: float
 *                 example: 76.9558
 *               delivery_id:
 *                 type: integer
 *                 description: |
 *                   ID of the active task. When provided, a tracking record is written
 *                   to delivery_status_history with remarks = "location_update".
 *     responses:
 *       200:
 *         description: Location saved to delivery_personnel + optional history ping
 *       400:
 *         description: latitude and longitude are required
 *       404:
 *         description: Delivery profile not found
 */
router.patch("/", ...guard, ctrl.updateLocation);

/**
 * @swagger
 * /delivery/location/history/{delivery_id}:
 *   get:
 *     summary: Get the full GPS trail for a specific task
 *     tags: [Delivery Location]
 *     description: |
 *       Returns all location_update pings stored in delivery_status_history for
 *       a given task. Useful for admin map replay after task completion.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: delivery_id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Array of { latitude, longitude, created_at } ordered ASC
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
 *                       latitude:   { type: number }
 *                       longitude:  { type: number }
 *                       created_at: { type: string, format: date-time }
 *       404:
 *         description: Task not found
 */
router.get("/history/:delivery_id", ...guard, ctrl.getLocationHistory);

module.exports = router;