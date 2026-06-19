// src/routes/delivery/profileRoutes.js
const router = require("express").Router();
const ctrl   = require("../../controllers/delivery/profileController");
const { authenticate, authorizeRoles } = require("../../middleware/auth");

const guard = [authenticate, authorizeRoles("delivery")];

/**
 * @swagger
 * tags:
 *   name: Delivery Profile
 *   description: Driver profile, dashboard stats, and task history
 */

/**
 * @swagger
 * /delivery/dashboard:
 *   get:
 *     summary: Get driver dashboard — today's stats + active task
 *     tags: [Delivery Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Driver info, today's counts, and the currently active task
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     driver:
 *                       type: object
 *                       properties:
 *                         full_name:          { type: string }
 *                         profile_photo_url:  { type: string, nullable: true }
 *                         vehicle_type:       { type: string }
 *                         vehicle_number:     { type: string }
 *                         is_available:       { type: boolean }
 *                         rating:             { type: number }
 *                         all_time_completed: { type: integer }
 *                         all_time_assigned:  { type: integer }
 *                     today:
 *                       type: object
 *                       properties:
 *                         total:     { type: integer }
 *                         completed: { type: integer }
 *                         pending:   { type: integer }
 *                         failed:    { type: integer }
 *                     active_task:
 *                       type: object
 *                       nullable: true
 *                       description: The task currently in_transit or reached
 */
router.get("/dashboard", ...guard, ctrl.getDashboard);

/**
 * @swagger
 * /delivery/profile:
 *   get:
 *     summary: Get the logged-in driver's full profile
 *     tags: [Delivery Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Driver profile including linked user record
 *       404:
 *         description: Delivery profile not found
 */
router.get("/profile", ...guard, ctrl.getProfile);

/**
 * @swagger
 * /delivery/profile:
 *   put:
 *     summary: Update driver profile (name, vehicle, licence) and/or profile photo
 *     tags: [Delivery Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               full_name:           { type: string }
 *               vehicle_type:        { type: string, enum: [bike, auto, tempo, truck, van] }
 *               vehicle_number:      { type: string }
 *               license_number:      { type: string }
 *               license_expiry_date: { type: string, format: date }
 *               profile_photo:       { type: string, format: binary, description: "Max 5 MB. JPEG/PNG/WebP." }
 *     responses:
 *       200:
 *         description: Profile updated
 *       404:
 *         description: Delivery profile not found
 */
router.put(
  "/profile",
  ...guard,
  ctrl.uploadProfilePhoto, // multer middleware
  ctrl.updateProfile
);

/**
 * @swagger
 * /delivery/history:
 *   get:
 *     summary: Paginated task history (completed, failed, cancelled)
 *     tags: [Delivery Profile]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: from_date
 *         schema: { type: string, format: date, example: "2025-06-01" }
 *       - in: query
 *         name: to_date
 *         schema: { type: string, format: date, example: "2025-06-30" }
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [pickup, delivery] }
 *         description: Filter by pickup or delivery tasks only
 *     responses:
 *       200:
 *         description: Paginated history rows + summary counts
 */
router.get("/history", ...guard, ctrl.getTaskHistory);

module.exports = router;