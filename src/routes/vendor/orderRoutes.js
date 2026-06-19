const router = require("express").Router();
const ctrl = require("../../controllers/vendor/orderController");
const { authenticate } = require("../../middleware/auth");

// ═══════════════════════════════════════════════════════════════
// ADDRESS ROUTES — must be declared BEFORE /:order_id routes
// to prevent Express matching "addresses" as an order_id param
// ═══════════════════════════════════════════════════════════════

/**
 * @swagger
 * /vendor/orders/addresses:
 *   get:
 *     summary: Get all active delivery addresses (used in checkout address picker)
 *     tags: [Vendor Orders]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of addresses, default address first
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 - address_id: 1
 *                   address_label: "Main Shop"
 *                   address_line1: "12, MG Road"
 *                   city: "Coimbatore"
 *                   state: "Tamil Nadu"
 *                   pincode: "641001"
 *                   is_default: true
 */
router.get("/addresses", authenticate, ctrl.getAddresses);

/**
 * @swagger
 * /vendor/orders/addresses:
 *   post:
 *     summary: Add a new delivery address
 *     tags: [Vendor Orders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [address_label, address_line1, city, state, pincode]
 *             properties:
 *               address_label:  { type: string, example: "Branch 1" }
 *               contact_person: { type: string, example: "Rajan Kumar" }
 *               contact_number: { type: string, example: "9876543210" }
 *               address_line1:  { type: string, example: "12, MG Road" }
 *               address_line2:  { type: string }
 *               landmark:       { type: string, example: "Near bus stand" }
 *               city:           { type: string, example: "Coimbatore" }
 *               state:          { type: string, example: "Tamil Nadu" }
 *               pincode:        { type: string, example: "641001" }
 *               latitude:       { type: number, example: 11.0168 }
 *               longitude:      { type: number, example: 76.9558 }
 *               is_default:     { type: boolean, default: false }
 *     responses:
 *       201:
 *         description: Address added successfully
 *       400:
 *         description: Validation error
 */
router.post("/addresses", authenticate, ctrl.addAddress);

/**
 * @swagger
 * /vendor/orders/addresses/{address_id}:
 *   put:
 *     summary: Update an existing address
 *     tags: [Vendor Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: address_id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               address_label:  { type: string }
 *               contact_person: { type: string }
 *               contact_number: { type: string }
 *               address_line1:  { type: string }
 *               address_line2:  { type: string }
 *               landmark:       { type: string }
 *               city:           { type: string }
 *               state:          { type: string }
 *               pincode:        { type: string }
 *               latitude:       { type: number }
 *               longitude:      { type: number }
 *               is_default:     { type: boolean }
 *     responses:
 *       200:
 *         description: Address updated successfully
 *       404:
 *         description: Address not found
 */
router.put("/addresses/:address_id", authenticate, ctrl.updateAddress);

/**
 * @swagger
 * /vendor/orders/addresses/{address_id}/set-default:
 *   patch:
 *     summary: Set an address as the default delivery address
 *     tags: [Vendor Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: address_id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Default address updated
 *       404:
 *         description: Address not found
 */
router.patch("/addresses/:address_id/set-default", authenticate, ctrl.setDefaultAddress);

/**
 * @swagger
 * /vendor/orders/addresses/{address_id}:
 *   delete:
 *     summary: Remove a delivery address (soft delete)
 *     description: Cannot remove the last active address.
 *     tags: [Vendor Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: address_id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Address removed successfully
 *       400:
 *         description: Cannot remove the only active address
 *       404:
 *         description: Address not found
 */
router.delete("/addresses/:address_id", authenticate, ctrl.removeAddress);

// ═══════════════════════════════════════════════════════════════
// ORDER ROUTES — declared AFTER address routes
// ═══════════════════════════════════════════════════════════════

/**
 * @swagger
 * /vendor/orders:
 *   get:
 *     summary: Get paginated vendor orders filtered by tab, payment status, date range, or order number
 *     tags: [Vendor Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [placed, processing, in_transit, delivered, cancelled]
 *           default: placed
 *         description: |
 *           Maps to Flutter tabs:
 *           - placed     → placed / confirmed
 *           - processing → processing / ready
 *           - in_transit → dispatched
 *           - delivered  → delivered
 *           - cancelled  → cancelled / returned
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Partial match on order number (LIKE %value%)
 *       - in: query
 *         name: order_number
 *         schema: { type: string }
 *         description: Exact match on order number. Takes priority over search when both are provided.
 *       - in: query
 *         name: payment_status
 *         schema:
 *           type: string
 *           enum: [pending, paid, partial, failed, refunded]
 *         description: Filter by payment status.
 *       - in: query
 *         name: from_date
 *         schema:
 *           type: string
 *           format: date
 *           example: "2025-01-01"
 *         description: Start of date range (inclusive). Filters on created_at.
 *       - in: query
 *         name: to_date
 *         schema:
 *           type: string
 *           format: date
 *           example: "2025-06-30"
 *         description: End of date range (inclusive, covers full day until 23:59:59).
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Paginated list of orders
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
 *                     orders:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           order_id:       { type: string }
 *                           order_number:   { type: string }
 *                           order_status:
 *                             type: string
 *                             enum: [placed, confirmed, processing, ready, dispatched, delivered, cancelled, returned]
 *                           status:
 *                             type: string
 *                             enum: [PLACED, PROCESSING, IN TRANSIT, DELIVERED, CANCELLED]
 *                             description: Flutter-mapped display label.
 *                           payment_status:
 *                             type: string
 *                             enum: [pending, paid, partial, failed, refunded]
 *                           price:          { type: number, example: 1250.00 }
 *                           date:           { type: string, example: "10 Jun 2025" }
 *                           items_count:    { type: integer, example: 3 }
 *                           items_list:
 *                             type: array
 *                             items:
 *                               type: object
 *                               properties:
 *                                 product_name: { type: string, nullable: true }
 *                                 quantity_kg:  { type: number, example: 25.5 }
 *                           image:
 *                             type: string
 *                             nullable: true
 *                             description: Image URL of the first order item.
 *                           eta:
 *                             type: string
 *                             nullable: true
 *                             example: "25 mins"
 *                             description: ETA from first active delivery, null if not yet assigned.
 *                           estimated_delivery: { type: string, nullable: true, example: "12 Jun 2025" }
 *                           delivery_date:      { type: string, nullable: true, example: "13 Jun 2025" }
 *                           cancelled_date:     { type: string, nullable: true }
 *                           reason:             { type: string, nullable: true, description: Cancellation reason. }
 *                           delivery_person:
 *                             nullable: true
 *                             type: object
 *                             properties:
 *                               name:           { type: string }
 *                               vehicle_number: { type: string }
 *                               mobile:         { type: string }
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         total:       { type: integer }
 *                         page:        { type: integer }
 *                         limit:       { type: integer }
 *                         total_pages: { type: integer }
 *       404:
 *         description: Vendor not found
 *       500:
 *         description: Internal server error
 */
router.get("/", authenticate, ctrl.getOrders);

/**
 * @swagger
 * /vendor/orders/{order_id}:
 *   get:
 *     summary: Get full order detail for tracking screen
 *     tags: [Vendor Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: order_id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Full order with timeline, items, and driver info
 *       404:
 *         description: Order not found
 */
router.get("/:order_id", authenticate, ctrl.getOrderDetail);

/**
 * @swagger
 * /vendor/orders/{order_id}/cancel:
 *   post:
 *     summary: Cancel an order (only placed or confirmed orders)
 *     tags: [Vendor Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: order_id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason: { type: string }
 *     responses:
 *       200:
 *         description: Order cancelled successfully
 *       400:
 *         description: Order cannot be cancelled in current status
 */
router.post("/:order_id/cancel", authenticate, ctrl.cancelOrder);

module.exports = router;