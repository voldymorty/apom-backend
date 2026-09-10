const router = require("express").Router();
const ctrl = require("../../controllers/admin/PickupdeliveryController");
const { verifyAdminToken } = require("../../middleware/adminAuth");

router.use(verifyAdminToken);

/**
 * @swagger
 * tags:
 *   name: Admin PickupsDeliveries
 *   description: Admin - Pickups & Deliveries Management
 */

// ─────────────────────────────────────────────────────────────────────────────
// POST /admin/pickups-deliveries
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /admin/pickups-deliveries:
 *   post:
 *     summary: Create a new pickup or delivery task
 *     tags: [Admin PickupsDeliveries]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - delivery_type
 *             properties:
 *               delivery_type:
 *                 type: string
 *                 enum: [pickup, delivery]
 *                 example: pickup
 *               farmer_id:
 *                 type: integer
 *                 example: 1
 *                 description: Required if delivery_type is pickup
 *               crop_id:
 *                 type: integer
 *                 example: 5
 *                 description: Required if delivery_type is pickup
 *               pickup_address:
 *                 type: string
 *                 example: 123 Farm Road Pollachi
 *                 description: Required if delivery_type is pickup
 *               pickup_contact_name:
 *                 type: string
 *                 example: Rajan Kumar
 *               pickup_contact_number:
 *                 type: string
 *                 example: "9876543210"
 *               order_id:
 *                 type: integer
 *                 example: 10
 *                 description: Required if delivery_type is delivery
 *               vendor_id:
 *                 type: integer
 *                 example: 3
 *                 description: Required if delivery_type is delivery
 *               delivery_address:
 *                 type: string
 *                 example: 12 Market Street Chennai
 *                 description: Required if delivery_type is delivery
 *               delivery_contact_name:
 *                 type: string
 *                 example: Karthik R
 *               delivery_contact_number:
 *                 type: string
 *                 example: "9123456789"
 *               delivery_person_id:
 *                 type: integer
 *                 example: 2
 *                 description: Optional - can assign later via /assign
 *               scheduled_date:
 *                 type: string
 *                 format: date
 *                 example: "2026-04-10"
 *               scheduled_time_slot:
 *                 type: string
 *                 example: 09:00-12:00
 *               expected_quantity_kg:
 *                 type: number
 *                 example: 100.00
 *               delivery_notes:
 *                 type: string
 *                 example: Handle with care
 *     responses:
 *       201:
 *         description: Task created successfully
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
 *                   example: Pickup task created successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     delivery_id:
 *                       type: integer
 *                       example: 1
 *                     delivery_number:
 *                       type: string
 *                       example: PKP-20260409-0001
 *                     delivery_type:
 *                       type: string
 *                       example: pickup
 *                     status:
 *                       type: string
 *                       example: assigned
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Missing required fields
 *       404:
 *         description: Farmer, crop, order or vendor not found
 *       409:
 *         description: Crop is not available for pickup
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Internal server error
 */
router.post("/", ctrl.createPickupDelivery);

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/pickups-deliveries
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /admin/pickups-deliveries:
 *   get:
 *     summary: List all pickup and delivery tasks with filters
 *     tags: [Admin PickupsDeliveries]
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
 *         name: search
 *         description: |
 *           Search across:
 *           - Pickup: delivery number, farmer name, product name, delivery person name, pickup address
 *           - Delivery: delivery number, order number, vendor shop name, vendor owner name, delivery address
 *         schema:
 *           type: string
 *           example: Tomato
 *       - in: query
 *         name: delivery_type
 *         schema:
 *           type: string
 *           enum: [pickup, delivery]
 *           example: pickup
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [assigned, accepted, in_transit, reached, completed, failed, cancelled]
 *           example: assigned
 *       - in: query
 *         name: delivery_person_id
 *         schema:
 *           type: integer
 *           example: 2
 *       - in: query
 *         name: farmer_id
 *         schema:
 *           type: integer
 *           example: 1
 *       - in: query
 *         name: vendor_id
 *         schema:
 *           type: integer
 *           example: 3
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
 *         description: Tasks fetched successfully
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
 *                   example: Pickup/delivery tasks fetched successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     tasks:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           delivery_id:
 *                             type: integer
 *                             example: 1
 *                           delivery_number:
 *                             type: string
 *                             example: PKP-20260409-0001
 *                           delivery_type:
 *                             type: string
 *                             example: pickup
 *                           status:
 *                             type: string
 *                             example: assigned
 *                           scheduled_date:
 *                             type: string
 *                             format: date
 *                           scheduled_time_slot:
 *                             type: string
 *                             example: 09:00-12:00
 *                           expected_quantity_kg:
 *                             type: number
 *                             example: 100.00
 *                           actual_quantity_kg:
 *                             type: number
 *                             nullable: true
 *                           pickup_address:
 *                             type: string
 *                             nullable: true
 *                           delivery_address:
 *                             type: string
 *                             nullable: true
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
 *                           farmer:
 *                             type: object
 *                             nullable: true
 *                             properties:
 *                               farmer_id:
 *                                 type: integer
 *                                 example: 1
 *                               full_name:
 *                                 type: string
 *                                 example: Rajan Kumar
 *                           vendor:
 *                             type: object
 *                             nullable: true
 *                             properties:
 *                               vendor_id:
 *                                 type: integer
 *                                 example: 3
 *                               shop_name:
 *                                 type: string
 *                                 example: Fresh Mart
 *                           created_at:
 *                             type: string
 *                             format: date-time
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                           example: 80
 *                         page:
 *                           type: integer
 *                           example: 1
 *                         limit:
 *                           type: integer
 *                           example: 20
 *                         total_pages:
 *                           type: integer
 *                           example: 4
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Internal server error
 */
router.get("/", ctrl.listPickupDeliveries);

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/pickups-deliveries/:delivery_id
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /admin/pickups-deliveries/{delivery_id}:
 *   get:
 *     summary: Get full pickup/delivery task record with status history
 *     tags: [Admin PickupsDeliveries]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: delivery_id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *     responses:
 *       200:
 *         description: Task fetched successfully
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
 *                   example: Pickup/delivery task fetched successfully
 *                 data:
 *                   type: object
 *                   description: Full pickup/delivery record with delivery_person, farmer, vendor, crop, order and status_history
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Task not found
 *       500:
 *         description: Internal server error
 */
router.get("/:delivery_id", ctrl.getPickupDeliveryById);

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /admin/pickups-deliveries/:delivery_id/assign
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /admin/pickups-deliveries/{delivery_id}/assign:
 *   patch:
 *     summary: Assign or reassign a delivery person to a task
 *     tags: [Admin PickupsDeliveries]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: delivery_id
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
 *             required:
 *               - delivery_person_id
 *             properties:
 *               delivery_person_id:
 *                 type: integer
 *                 example: 2
 *               scheduled_date:
 *                 type: string
 *                 format: date
 *                 example: "2026-04-10"
 *               scheduled_time_slot:
 *                 type: string
 *                 example: 09:00-12:00
 *     responses:
 *       200:
 *         description: Assigned or reassigned successfully
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
 *                   example: Delivery personnel assigned successfully
 *       400:
 *         description: Missing delivery_person_id
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Task or delivery personnel not found
 *       409:
 *         description: Cannot assign to a completed or cancelled task
 *       500:
 *         description: Internal server error
 */
router.patch("/:delivery_id/assign", ctrl.assignDeliveryPersonnel);

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /admin/pickups-deliveries/:delivery_id/status
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /admin/pickups-deliveries/{delivery_id}/status:
 *   patch:
 *     summary: Manually update task status
 *     tags: [Admin PickupsDeliveries]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: delivery_id
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
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [assigned, accepted, in_transit, reached, completed, failed]
 *                 example: in_transit
 *               remarks:
 *                 type: string
 *                 example: Driver confirmed pickup started
 *     responses:
 *       200:
 *         description: Status updated successfully
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
 *                   example: Status updated successfully
 *       400:
 *         description: Missing or invalid status
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Task not found
 *       409:
 *         description: Cannot update a cancelled task
 *       500:
 *         description: Internal server error
 */
router.patch("/:delivery_id/status", ctrl.updatePickupDeliveryStatus);

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /admin/pickups-deliveries/:delivery_id/cancel
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /admin/pickups-deliveries/{delivery_id}/cancel:
 *   patch:
 *     summary: Cancel a pickup or delivery task
 *     tags: [Admin PickupsDeliveries]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: delivery_id
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
 *             required:
 *               - failure_reason
 *             properties:
 *               failure_reason:
 *                 type: string
 *                 example: Farmer not available at pickup location
 *     responses:
 *       200:
 *         description: Task cancelled successfully
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
 *                   example: Task cancelled successfully
 *       400:
 *         description: Missing failure_reason
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Task not found
 *       409:
 *         description: Task is already cancelled or completed
 *       500:
 *         description: Internal server error
 */
router.patch("/:delivery_id/cancel", ctrl.cancelPickupDelivery);

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /admin/pickups-deliveries/:delivery_id/finalize-procurement
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /admin/pickups-deliveries/{delivery_id}/finalize-procurement:
 *   patch:
 *     summary: Finalize procurement and add accepted stock to inventory
 *     description: >
 *       Supports two mutually exclusive ways of specifying accepted quantity/amount:
 *       (1) legacy single-grade fields (accepted_quantity_kg, final_procurement_amount, final_grade), or
 *       (2) a `splits` array to divide the procured quantity across multiple grades, each with its own
 *       quantity and amount. If `splits` is provided, it takes precedence and the legacy fields are ignored.
 *       `wastage_quantity_kg` always applies to the whole pickup regardless of which mode is used.
 *     tags: [Admin PickupsDeliveries]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: delivery_id
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
 *               wastage_quantity_kg:
 *                 type: number
 *                 format: float
 *                 example: 5
 *                 description: Wastage for the whole pickup, removed before any grade split.
 *               splits:
 *                 type: array
 *                 description: >
 *                   Multi-grade breakdown of the accepted quantity. When provided, accepted_quantity_kg,
 *                   final_procurement_amount and final_grade below are ignored — totals are derived from
 *                   this array instead. Sum of quantity_kg across splits must not exceed
 *                   (procured quantity - wastage_quantity_kg).
 *                 items:
 *                   type: object
 *                   required: [grade, quantity_kg, amount]
 *                   properties:
 *                     grade:
 *                       type: string
 *                       example: A
 *                     quantity_kg:
 *                       type: number
 *                       format: float
 *                       example: 20
 *                     amount:
 *                       type: number
 *                       format: float
 *                       example: 800
 *                 example:
 *                   - grade: A
 *                     quantity_kg: 20
 *                     amount: 800
 *                   - grade: B
 *                     quantity_kg: 10
 *                     amount: 300
 *                   - grade: C
 *                     quantity_kg: 10
 *                     amount: 250
 *               accepted_quantity_kg:
 *                 type: number
 *                 format: float
 *                 example: 95
 *                 description: Legacy single-grade mode only. Ignored if `splits` is provided.
 *               final_procurement_amount:
 *                 type: number
 *                 format: float
 *                 example: 4750
 *                 description: Legacy single-grade mode only. Required if `splits` is not provided. Ignored if `splits` is provided.
 *               final_grade:
 *                 type: string
 *                 example: A
 *                 description: Legacy single-grade mode only. Ignored if `splits` is provided.
 *               payment_status:
 *                 type: string
 *                 enum: [pending, processing, paid, failed]
 *                 example: paid
 *               payment_date:
 *                 type: string
 *                 format: date-time
 *                 example: 2026-06-13T10:30:00Z
 *               payment_method:
 *                 type: string
 *                 enum: [bank_transfer, upi, cash, cheque]
 *                 example: upi
 *               transaction_id:
 *                 type: string
 *                 example: TXN123456
 *               transaction_reference:
 *                 type: string
 *                 example: UPIREF987654
 *               procurement_remarks:
 *                 type: string
 *                 example: Quality downgraded from A+ to A after inspection
 *     responses:
 *       200:
 *         description: Procurement finalized successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Pickup task not found
 *       409:
 *         description: Procurement already finalized or pickup not eligible
 *       500:
 *         description: Internal server error
 */
router.patch("/:delivery_id/finalize-procurement", ctrl.finalizeProcurement);

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/pickups-deliveries/:delivery_id/history
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /admin/pickups-deliveries/{delivery_id}/history:
 *   get:
 *     summary: Get status change history for a task
 *     tags: [Admin PickupsDeliveries]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: delivery_id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *     responses:
 *       200:
 *         description: Status history fetched successfully
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
 *                   example: Status history fetched successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     history:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           history_id:
 *                             type: integer
 *                             example: 1
 *                           delivery_id:
 *                             type: integer
 *                             example: 1
 *                           old_status:
 *                             type: string
 *                             nullable: true
 *                             example: assigned
 *                           new_status:
 *                             type: string
 *                             example: accepted
 *                           remarks:
 *                             type: string
 *                             nullable: true
 *                           changed_user:
 *                             type: object
 *                             nullable: true
 *                             properties:
 *                               user_id:
 *                                 type: integer
 *                                 example: 1
 *                               mobile_number:
 *                                 type: string
 *                                 example: "9876543210"
 *                           created_at:
 *                             type: string
 *                             format: date-time
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Task not found
 *       500:
 *         description: Internal server error
 */
router.get("/:delivery_id/history", ctrl.getStatusHistory);

module.exports = router;