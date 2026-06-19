const router = require("express").Router();
const ctrl = require("../../controllers/admin/DeliverypersonnelController");
const { verifyAdminToken } = require("../../middleware/adminAuth");

// All delivery personnel routes are protected
router.use(verifyAdminToken);

/**
 * @swagger
 * tags:
 *   name: Admin DeliveryPersonnel
 *   description: Admin - Delivery Personnel Management
 */

// ─────────────────────────────────────────────────────────────────────────────
// POST /admin/delivery-personnel
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /admin/delivery-personnel:
 *   post:
 *     summary: Create a new delivery personnel account
 *     tags: [Admin DeliveryPersonnel]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - mobile_number
 *               - password
 *               - full_name
 *               - vehicle_type
 *               - vehicle_number
 *             properties:
 *               mobile_number:
 *                 type: string
 *                 example: "9876543210"
 *               password:
 *                 type: string
 *                 example: Apom@1234
 *               email:
 *                 type: string
 *                 example: driver@example.com
 *               full_name:
 *                 type: string
 *                 example: Murugan S
 *               vehicle_type:
 *                 type: string
 *                 enum: [bike, auto, tempo, truck, van]
 *                 example: bike
 *               vehicle_number:
 *                 type: string
 *                 example: TN33AB1234
 *               license_number:
 *                 type: string
 *                 example: TN2020123456
 *               license_expiry_date:
 *                 type: string
 *                 format: date
 *                 example: "2028-06-30"
 *     responses:
 *       201:
 *         description: Delivery personnel account created successfully
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
 *                   example: Delivery personnel account created successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     delivery_person_id:
 *                       type: integer
 *                       example: 1
 *                     user_id:
 *                       type: integer
 *                       example: 10
 *                     mobile_number:
 *                       type: string
 *                       example: "9876543210"
 *                     full_name:
 *                       type: string
 *                       example: Murugan S
 *                     vehicle_type:
 *                       type: string
 *                       example: bike
 *                     vehicle_number:
 *                       type: string
 *                       example: TN33AB1234
 *                     license_number:
 *                       type: string
 *                       example: TN2020123456
 *                     license_expiry_date:
 *                       type: string
 *                       format: date
 *                     is_active:
 *                       type: boolean
 *                       example: true
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Missing required fields
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       409:
 *         description: Mobile number, vehicle number or license number already exists
 *       500:
 *         description: Internal server error
 */
router.post("/", ctrl.createDeliveryPersonnel);

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/delivery-personnel
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /admin/delivery-personnel:
 *   get:
 *     summary: List all delivery personnel with pagination & filters
 *     tags: [Admin DeliveryPersonnel]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           example: 1
 *         description: Page number (default 1)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           example: 20
 *         description: Records per page (default 20, max 100)
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *           example: Murugan
 *         description: Search by full_name or mobile_number
 *       - in: query
 *         name: vehicle_type
 *         schema:
 *           type: string
 *           enum: [bike, auto, tempo, truck, van]
 *           example: bike
 *         description: Filter by vehicle type
 *       - in: query
 *         name: is_available
 *         schema:
 *           type: boolean
 *           example: true
 *         description: Filter by availability status
 *       - in: query
 *         name: is_active
 *         schema:
 *           type: boolean
 *           example: true
 *         description: Filter by active status
 *       - in: query
 *         name: sort_by
 *         schema:
 *           type: string
 *           enum: [created_at, total_deliveries, rating]
 *           example: created_at
 *         description: Sort column (default created_at)
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           example: desc
 *         description: Sort direction (default desc)
 *     responses:
 *       200:
 *         description: Delivery personnel fetched successfully
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
 *                   example: Delivery personnel fetched successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     personnel:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           delivery_person_id:
 *                             type: integer
 *                             example: 1
 *                           full_name:
 *                             type: string
 *                             example: Murugan S
 *                           mobile_number:
 *                             type: string
 *                             example: "9876543210"
 *                           email:
 *                             type: string
 *                             example: driver@example.com
 *                           is_active:
 *                             type: boolean
 *                             example: true
 *                           is_verified:
 *                             type: boolean
 *                             example: false
 *                           profile_photo_url:
 *                             type: string
 *                             nullable: true
 *                             example: https://cdn.example.com/photo.jpg
 *                           vehicle_type:
 *                             type: string
 *                             example: bike
 *                           vehicle_number:
 *                             type: string
 *                             example: TN33AB1234
 *                           license_number:
 *                             type: string
 *                             example: TN2020123456
 *                           license_expiry_date:
 *                             type: string
 *                             format: date
 *                           is_available:
 *                             type: boolean
 *                             example: true
 *                           total_deliveries:
 *                             type: integer
 *                             example: 45
 *                           completed_deliveries:
 *                             type: integer
 *                             example: 42
 *                           rating:
 *                             type: number
 *                             example: 4.50
 *                           created_at:
 *                             type: string
 *                             format: date-time
 *                           last_login:
 *                             type: string
 *                             format: date-time
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                           example: 50
 *                         page:
 *                           type: integer
 *                           example: 1
 *                         limit:
 *                           type: integer
 *                           example: 20
 *                         total_pages:
 *                           type: integer
 *                           example: 3
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Internal server error
 */
router.get("/", ctrl.listDeliveryPersonnel);

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/delivery-personnel/:delivery_person_id
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /admin/delivery-personnel/{delivery_person_id}:
 *   get:
 *     summary: Get full delivery personnel profile
 *     tags: [Admin DeliveryPersonnel]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: delivery_person_id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *     responses:
 *       200:
 *         description: Delivery personnel profile fetched successfully
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
 *                   example: Delivery personnel profile fetched successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     delivery_person_id:
 *                       type: integer
 *                       example: 1
 *                     full_name:
 *                       type: string
 *                       example: Murugan S
 *                     mobile_number:
 *                       type: string
 *                       example: "9876543210"
 *                     email:
 *                       type: string
 *                       example: driver@example.com
 *                     is_active:
 *                       type: boolean
 *                       example: true
 *                     is_verified:
 *                       type: boolean
 *                       example: false
 *                     profile_complete:
 *                       type: boolean
 *                       example: false
 *                     profile_photo_url:
 *                       type: string
 *                       nullable: true
 *                       example: https://cdn.example.com/photo.jpg
 *                     vehicle_type:
 *                       type: string
 *                       enum: [bike, auto, tempo, truck, van]
 *                       example: bike
 *                     vehicle_number:
 *                       type: string
 *                       example: TN33AB1234
 *                     license_number:
 *                       type: string
 *                       nullable: true
 *                       example: TN2020123456
 *                     license_expiry_date:
 *                       type: string
 *                       format: date
 *                       nullable: true
 *                     is_available:
 *                       type: boolean
 *                       example: true
 *                     current_latitude:
 *                       type: number
 *                       nullable: true
 *                       example: 10.9317
 *                     current_longitude:
 *                       type: number
 *                       nullable: true
 *                       example: 78.1198
 *                     last_location_update:
 *                       type: string
 *                       format: date-time
 *                       nullable: true
 *                     total_deliveries:
 *                       type: integer
 *                       example: 45
 *                     completed_deliveries:
 *                       type: integer
 *                       example: 42
 *                     rating:
 *                       type: number
 *                       example: 4.50
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                     updated_at:
 *                       type: string
 *                       format: date-time
 *                     last_login:
 *                       type: string
 *                       format: date-time
 *                       nullable: true
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Delivery personnel not found
 *       500:
 *         description: Internal server error
 */
router.get("/:delivery_person_id", ctrl.getDeliveryPersonnelById);

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /admin/delivery-personnel/:delivery_person_id
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /admin/delivery-personnel/{delivery_person_id}:
 *   patch:
 *     summary: Update delivery personnel profile
 *     tags: [Admin DeliveryPersonnel]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: delivery_person_id
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
 *               full_name:
 *                 type: string
 *                 example: Murugan S
 *               vehicle_type:
 *                 type: string
 *                 enum: [bike, auto, tempo, truck, van]
 *                 example: bike
 *               vehicle_number:
 *                 type: string
 *                 example: TN33AB1234
 *               license_number:
 *                 type: string
 *                 example: TN2020123456
 *               license_expiry_date:
 *                 type: string
 *                 format: date
 *                 example: "2028-06-30"
 *               is_available:
 *                 type: boolean
 *                 example: true
 *               mobile_number:
 *                 type: string
 *                 example: "9876543210"
 *               email:
 *                 type: string
 *                 example: driver@example.com
 *               is_verified:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Delivery personnel updated successfully
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
 *                   example: Delivery personnel updated successfully
 *       400:
 *         description: No valid fields provided
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Delivery personnel not found
 *       409:
 *         description: Vehicle number, license number or mobile number already in use
 *       500:
 *         description: Internal server error
 */
router.patch("/:delivery_person_id", ctrl.updateDeliveryPersonnel);

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /admin/delivery-personnel/:delivery_person_id/activate
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /admin/delivery-personnel/{delivery_person_id}/activate:
 *   patch:
 *     summary: Activate delivery personnel (set is_active = true on users table)
 *     tags: [Admin DeliveryPersonnel]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: delivery_person_id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *     responses:
 *       200:
 *         description: Delivery personnel activated successfully
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
 *                   example: Delivery personnel activated successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Delivery personnel not found
 *       409:
 *         description: Delivery personnel is already active
 *       500:
 *         description: Internal server error
 */
router.patch("/:delivery_person_id/activate", ctrl.activateDeliveryPersonnel);

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /admin/delivery-personnel/:delivery_person_id/deactivate
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /admin/delivery-personnel/{delivery_person_id}/deactivate:
 *   patch:
 *     summary: Deactivate delivery personnel (set is_active = false on users table)
 *     tags: [Admin DeliveryPersonnel]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: delivery_person_id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *     responses:
 *       200:
 *         description: Delivery personnel deactivated successfully
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
 *                   example: Delivery personnel deactivated successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Delivery personnel not found
 *       409:
 *         description: Delivery personnel is already inactive
 *       500:
 *         description: Internal server error
 */
router.patch("/:delivery_person_id/deactivate", ctrl.deactivateDeliveryPersonnel);

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /admin/delivery-personnel/:delivery_person_id
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /admin/delivery-personnel/{delivery_person_id}:
 *   delete:
 *     summary: Hard delete delivery personnel and cascade user record
 *     tags: [Admin DeliveryPersonnel]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: delivery_person_id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *     responses:
 *       200:
 *         description: Delivery personnel deleted successfully
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
 *                   example: Delivery personnel deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Delivery personnel not found
 *       500:
 *         description: Internal server error
 */
router.delete("/:delivery_person_id", ctrl.deleteDeliveryPersonnel);

module.exports = router;