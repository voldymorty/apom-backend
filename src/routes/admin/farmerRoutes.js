const router = require("express").Router();
const ctrl = require("../../controllers/admin/farmerController");
const { verifyAdminToken } = require("../../middleware/adminAuth");

// All farmer routes are protected
router.use(verifyAdminToken);

/**
 * @swagger
 * tags:
 *   name: Admin Farmers
 *   description: Admin - Farmer Management
 */

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/farmers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /admin/farmers:
 *   get:
 *     summary: List all farmers with pagination & filters
 *     tags: [Admin Farmers]
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
 *           example: Rajan
 *         description: Search by full_name or mobile_number
 *       - in: query
 *         name: state_id
 *         schema:
 *           type: integer
 *           example: 23
 *         description: Filter by state
 *       - in: query
 *         name: district_id
 *         schema:
 *           type: integer
 *           example: 550
 *         description: Filter by district
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
 *           enum: [created_at, total_earnings, total_supplies]
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
 *         description: Farmers list fetched successfully
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
 *                   example: Farmers fetched successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     farmers:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           farmer_id:
 *                             type: integer
 *                             example: 1
 *                           full_name:
 *                             type: string
 *                             example: Rajan Kumar
 *                           mobile_number:
 *                             type: string
 *                             example: "9876543210"
 *                           profile_photo_url:
 *                             type: string
 *                             example: https://example.com/profile.jpg
 *                           email:
 *                             type: string
 *                             example: rajan@example.com
 *                           is_active:
 *                             type: boolean
 *                             example: true
 *                           is_verified:
 *                             type: boolean
 *                             example: true
 *                           farm_name:
 *                             type: string
 *                             example: Rajan Farms
 *                           location_address:
 *                             type: string
 *                             example: 123, Village Road, Pollachi
 *                           state:
 *                             type: string
 *                             example: Tamil Nadu
 *                           district:
 *                             type: string
 *                             example: Coimbatore
 *                           city:
 *                             type: string
 *                             example: Pollachi
 *                           latitude:
 *                             type: number
 *                             example: 10.6585
 *                           longitude:
 *                             type: number
 *                             example: 77.0088
 *                           total_land:
 *                             type: number
 *                             example: 5.5
 *                           land_unit:
 *                             type: string
 *                             example: acres
 *                           allocated_land:
 *                             type: number
 *                             example: 2.0
 *                           available_land:
 *                             type: number
 *                             example: 3.5
 *                           land_photo_url:
 *                             type: string
 *                             example: https://example.com/land.jpg
 *                           total_supplies:
 *                             type: integer
 *                             example: 12
 *                           total_earnings:
 *                             type: number
 *                             example: 45000.00
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
 *                           example: 100
 *                         page:
 *                           type: integer
 *                           example: 1
 *                         limit:
 *                           type: integer
 *                           example: 20
 *                         total_pages:
 *                           type: integer
 *                           example: 5
 *       401:
 *         description: Unauthorized - missing or invalid token
 *       403:
 *         description: Forbidden - not an admin
 *       500:
 *         description: Internal server error
 */
router.get("/", ctrl.listFarmers);

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/farmers/:farmer_id
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /admin/farmers/{farmer_id}:
 *   get:
 *     summary: Get full farmer profile
 *     tags: [Admin Farmers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: farmer_id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *         description: Farmer ID
 *     responses:
 *       200:
 *         description: Farmer profile fetched successfully
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
 *                   example: Farmer profile fetched successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     farmer_id:
 *                       type: integer
 *                       example: 1
 *                     full_name:
 *                       type: string
 *                       example: Rajan Kumar
 *                     mobile_number:
 *                       type: string
 *                       example: "9876543210"
 *                     email:
 *                       type: string
 *                       example: rajan@example.com
 *                     is_active:
 *                       type: boolean
 *                       example: true
 *                     is_verified:
 *                       type: boolean
 *                       example: true
 *                     profile_complete:
 *                       type: boolean
 *                       example: true
 *                     aadhar_number:
 *                       type: string
 *                       example: XXXX-XXXX-1234
 *                       description: Masked for security
 *                     farm_name:
 *                       type: string
 *                       example: Rajan Farms
 *                     location_address:
 *                       type: string
 *                       example: 123 Main Street Pollachi
 *                     state:
 *                       type: object
 *                       properties:
 *                         state_id:
 *                           type: integer
 *                           example: 23
 *                         state_name:
 *                           type: string
 *                           example: Tamil Nadu
 *                         state_code:
 *                           type: string
 *                           example: TN
 *                     district:
 *                       type: object
 *                       properties:
 *                         district_id:
 *                           type: integer
 *                           example: 550
 *                         district_name:
 *                           type: string
 *                           example: Coimbatore
 *                     city:
 *                       type: object
 *                       properties:
 *                         city_id:
 *                           type: integer
 *                           example: 10
 *                         city_name:
 *                           type: string
 *                           example: Pollachi
 *                     pincode:
 *                       type: string
 *                       example: "642001"
 *                     latitude:
 *                       type: number
 *                       example: 10.6602
 *                     longitude:
 *                       type: number
 *                       example: 77.0100
 *                     total_land:
 *                       type: number
 *                       example: 5.5
 *                     land_unit:
 *                       type: string
 *                       example: acres
 *                     allocated_land:
 *                       type: number
 *                       example: 3.0
 *                     available_land:
 *                       type: number
 *                       example: 2.5
 *                     profile_photo_url:
 *                       type: string
 *                       example: https://cdn.example.com/photo.jpg
 *                     land_photo_url:
 *                       type: string
 *                       example: https://cdn.example.com/land.jpg
 *                     total_supplies:
 *                       type: integer
 *                       example: 12
 *                     total_earnings:
 *                       type: number
 *                       example: 45000.00
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                     updated_at:
 *                       type: string
 *                       format: date-time
 *                     last_login:
 *                       type: string
 *                       format: date-time
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Farmer not found
 *       500:
 *         description: Internal server error
 */
router.get("/:farmer_id", ctrl.getFarmerById);

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/farmers/:farmer_id/crops
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /admin/farmers/{farmer_id}/crops:
 *   get:
 *     summary: List all crops for a farmer
 *     tags: [Admin Farmers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: farmer_id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *     responses:
 *       200:
 *         description: Farmer crops fetched successfully
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
 *                   example: Farmer crops fetched successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     crops:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           crop_id:
 *                             type: integer
 *                             example: 5
 *                           farmer_id:
 *                             type: integer
 *                             example: 1
 *                           product_id:
 *                             type: integer
 *                             example: 10
 *                           quantity_kg:
 *                             type: number
 *                             example: 200.00
 *                           grade:
 *                             type: string
 *                             enum: [A, B, C]
 *                             example: A
 *                           expected_price_per_kg:
 *                             type: number
 *                             example: 45.00
 *                           harvest_date:
 *                             type: string
 *                             format: date
 *                             example: "2026-04-10"
 *                           is_ready:
 *                             type: boolean
 *                             example: true
 *                           status:
 *                             type: string
 *                             enum: [available, pickup_assigned, picked_up, cancelled]
 *                             example: available
 *                           crop_photo_url:
 *                             type: string
 *                             example: https://cdn.example.com/crop.jpg
 *                           partition:
 *                             type: object
 *                             nullable: true
 *                             properties:
 *                               partition_id:
 *                                 type: integer
 *                                 example: 2
 *                               crop_name:
 *                                 type: string
 *                                 example: North Field
 *                               partition_size_acres:
 *                                 type: number
 *                                 example: 2.0
 *                               current_status:
 *                                 type: string
 *                                 example: cultivated
 *                           created_at:
 *                             type: string
 *                             format: date-time
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Farmer not found
 *       500:
 *         description: Internal server error
 */
router.get("/:farmer_id/crops", ctrl.getFarmerCrops);

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/farmers/:farmer_id/earnings
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /admin/farmers/{farmer_id}/earnings:
 *   get:
 *     summary: Farmer earnings history
 *     tags: [Admin Farmers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: farmer_id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           example: 1
 *         description: Default 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           example: 20
 *         description: Default 20
 *       - in: query
 *         name: payment_status
 *         schema:
 *           type: string
 *           enum: [pending, processing, paid, failed]
 *           example: paid
 *         description: Filter by payment status
 *       - in: query
 *         name: from_date
 *         schema:
 *           type: string
 *           format: date
 *           example: "2026-01-01"
 *         description: Filter by created_at range start
 *       - in: query
 *         name: to_date
 *         schema:
 *           type: string
 *           format: date
 *           example: "2026-04-07"
 *         description: Filter by created_at range end
 *     responses:
 *       200:
 *         description: Farmer earnings fetched successfully
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
 *                   example: Farmer earnings fetched successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     earnings:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           earning_id:
 *                             type: integer
 *                             example: 11
 *                           farmer_id:
 *                             type: integer
 *                             example: 1
 *                           crop_id:
 *                             type: integer
 *                             example: 5
 *                           pickup_delivery_id:
 *                             type: integer
 *                             example: 7
 *                           quantity_supplied_kg:
 *                             type: number
 *                             example: 100.00
 *                           price_per_kg:
 *                             type: number
 *                             example: 45.00
 *                           total_amount:
 *                             type: number
 *                             example: 4500.00
 *                           commission_percentage:
 *                             type: number
 *                             example: 5.00
 *                           commission_amount:
 *                             type: number
 *                             example: 225.00
 *                           net_amount:
 *                             type: number
 *                             example: 4275.00
 *                           payment_status:
 *                             type: string
 *                             enum: [pending, processing, paid, failed]
 *                             example: paid
 *                           payment_date:
 *                             type: string
 *                             format: date-time
 *                           payment_method:
 *                             type: string
 *                             example: bank_transfer
 *                           transaction_reference:
 *                             type: string
 *                             example: TXN123456
 *                           crop:
 *                             type: object
 *                             nullable: true
 *                             properties:
 *                               crop_id:
 *                                 type: integer
 *                                 example: 5
 *                               grade:
 *                                 type: string
 *                                 example: A
 *                               quantity_kg:
 *                                 type: number
 *                                 example: 200.00
 *                           created_at:
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
 *       404:
 *         description: Farmer not found
 *       500:
 *         description: Internal server error
 */
router.get("/:farmer_id/earnings", ctrl.getFarmerEarnings);

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/farmers/:farmer_id/bank
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /admin/farmers/{farmer_id}/bank:
 *   get:
 *     summary: Get farmer bank details
 *     tags: [Admin Farmers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: farmer_id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *     responses:
 *       200:
 *         description: Farmer bank details fetched successfully
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
 *                   example: Farmer bank details fetched successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     bank_details:
 *                       type: object
 *                       nullable: true
 *                       properties:
 *                         bank_detail_id:
 *                           type: integer
 *                           example: 1
 *                         farmer_id:
 *                           type: integer
 *                           example: 1
 *                         account_holder_name:
 *                           type: string
 *                           example: Rajan Kumar
 *                         bank_name:
 *                           type: string
 *                           example: State Bank of India
 *                         account_number:
 *                           type: string
 *                           example: "1234567890"
 *                         ifsc_code:
 *                           type: string
 *                           example: SBIN0001234
 *                         branch_name:
 *                           type: string
 *                           example: Pollachi Branch
 *                         account_type:
 *                           type: string
 *                           enum: [savings, current]
 *                           example: savings
 *                         upi_id:
 *                           type: string
 *                           example: rajan@upi
 *                         is_verified:
 *                           type: boolean
 *                           example: true
 *                         verified_at:
 *                           type: string
 *                           format: date-time
 *                         is_primary:
 *                           type: boolean
 *                           example: true
 *                         created_at:
 *                           type: string
 *                           format: date-time
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Farmer not found
 *       500:
 *         description: Internal server error
 */
router.get("/:farmer_id/bank", ctrl.getFarmerBank);

/**
 * @swagger
 * /admin/farmers/{farmer_id}:
 *   patch:
 *     summary: Update farmer profile
 *     tags: [Admin Farmers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: farmer_id
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
 *                 example: Rajan Kumar
 *               farm_name:
 *                 type: string
 *                 example: Rajan Farms
 *               location_address:
 *                 type: string
 *                 example: 123 Main Street Pollachi
 *               state_id:
 *                 type: integer
 *                 example: 23
 *               district_id:
 *                 type: integer
 *                 example: 550
 *               city_id:
 *                 type: integer
 *                 example: 10
 *               pincode:
 *                 type: string
 *                 example: "642001"
 *               latitude:
 *                 type: number
 *                 example: 10.6602
 *               longitude:
 *                 type: number
 *                 example: 77.0100
 *               total_land:
 *                 type: number
 *                 example: 5.5
 *               land_unit:
 *                 type: string
 *                 enum: [acres, hectares, cent]
 *                 example: acres
 *               email:
 *                 type: string
 *                 example: rajan@example.com
 *               is_verified:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Farmer updated successfully
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
 *                   example: Farmer updated successfully
 *       400:
 *         description: No valid fields provided
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Farmer not found
 *       500:
 *         description: Internal server error
 */
router.patch("/:farmer_id", ctrl.updateFarmer);

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/farmers/:farmer_id/land
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /admin/farmers/{farmer_id}/land:
 *   get:
 *     summary: Get land partitions for a farmer
 *     tags: [Admin Farmers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: farmer_id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *     responses:
 *       200:
 *         description: Farmer land partitions fetched successfully
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
 *                   example: Farmer land partitions fetched successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     partitions:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           partition_id:
 *                             type: integer
 *                             example: 2
 *                           farmer_id:
 *                             type: integer
 *                             example: 1
 *                           crop_name:
 *                             type: string
 *                             example: North Field
 *                           partition_size_acres:
 *                             type: number
 *                             example: 2.00
 *                           planting_date:
 *                             type: string
 *                             format: date
 *                             example: "2026-01-15"
 *                           expected_harvest_date:
 *                             type: string
 *                             format: date
 *                             example: "2026-05-15"
 *                           actual_harvest_date:
 *                             type: string
 *                             format: date
 *                             nullable: true
 *                           expected_yield_kg:
 *                             type: number
 *                             example: 500.00
 *                           actual_yield_kg:
 *                             type: number
 *                             nullable: true
 *                           is_active:
 *                             type: boolean
 *                             example: true
 *                           current_status:
 *                             type: string
 *                             enum: [available, cultivated, fallow, preparation]
 *                             example: cultivated
 *                           notes:
 *                             type: string
 *                             nullable: true
 *                           created_at:
 *                             type: string
 *                             format: date-time
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Farmer not found
 *       500:
 *         description: Internal server error
 */
router.get("/:farmer_id/land", ctrl.getFarmerLand);

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /admin/farmers/:farmer_id/activate
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /admin/farmers/{farmer_id}/activate:
 *   patch:
 *     summary: Activate a farmer (set is_active = true on users table)
 *     tags: [Admin Farmers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: farmer_id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *     responses:
 *       200:
 *         description: Farmer activated successfully
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
 *                   example: Farmer activated successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Farmer not found
 *       409:
 *         description: Farmer is already active
 *       500:
 *         description: Internal server error
 */
router.patch("/:farmer_id/activate", ctrl.activateFarmer);

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /admin/farmers/:farmer_id/deactivate
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /admin/farmers/{farmer_id}/deactivate:
 *   patch:
 *     summary: Deactivate a farmer (set is_active = false on users table)
 *     tags: [Admin Farmers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: farmer_id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *     responses:
 *       200:
 *         description: Farmer deactivated successfully
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
 *                   example: Farmer deactivated successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Farmer not found
 *       409:
 *         description: Farmer is already inactive
 *       500:
 *         description: Internal server error
 */
router.patch("/:farmer_id/deactivate", ctrl.deactivateFarmer);

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /admin/farmers/:farmer_id
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /admin/farmers/{farmer_id}:
 *   delete:
 *     summary: Hard delete farmer and cascade user record
 *     tags: [Admin Farmers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: farmer_id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *     responses:
 *       200:
 *         description: Farmer deleted successfully
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
 *                   example: Farmer deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Farmer not found
 *       500:
 *         description: Internal server error
 */
router.delete("/:farmer_id", ctrl.deleteFarmer);

module.exports = router;