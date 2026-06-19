const router = require("express").Router();
const ctrl = require("../../controllers/admin/OrderController");
const { verifyAdminToken } = require("../../middleware/adminAuth");

router.use(verifyAdminToken);

/**
 * @swagger
 * tags:
 *   name: Admin Orders
 *   description: Admin - Order Management
 */

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/orders
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /admin/orders:
 *   get:
 *     summary: List all orders with pagination & filters
 *     tags: [Admin Orders]
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
 *         name: order_status
 *         schema:
 *           type: string
 *           enum: [placed, confirmed, processing, ready, dispatched, delivered, cancelled, returned]
 *           example: confirmed
 *       - in: query
 *         name: payment_status
 *         schema:
 *           type: string
 *           enum: [pending, paid, partial, failed, refunded]
 *           example: pending
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
 *           example: "2026-01-01"
 *       - in: query
 *         name: to_date
 *         schema:
 *           type: string
 *           format: date
 *           example: "2026-04-08"
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *           example: ORD-20260101
 *         description: Search by order_number
 *       - in: query
 *         name: sort_by
 *         schema:
 *           type: string
 *           enum: [order_date, final_amount]
 *           example: order_date
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           example: desc
 *     responses:
 *       200:
 *         description: Orders fetched successfully
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
 *                   example: Orders fetched successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     orders:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           order_id:
 *                             type: integer
 *                             example: 1
 *                           order_number:
 *                             type: string
 *                             example: ORD-20260101-0001
 *                           order_date:
 *                             type: string
 *                             format: date-time
 *                           order_status:
 *                             type: string
 *                             example: confirmed
 *                           payment_status:
 *                             type: string
 *                             example: pending
 *                           subtotal_amount:
 *                             type: number
 *                             example: 1000.00
 *                           discount_amount:
 *                             type: number
 *                             example: 50.00
 *                           tax_amount:
 *                             type: number
 *                             example: 18.00
 *                           delivery_charges:
 *                             type: number
 *                             example: 30.00
 *                           final_amount:
 *                             type: number
 *                             example: 998.00
 *                           expected_delivery_date:
 *                             type: string
 *                             format: date
 *                             nullable: true
 *                           vendor:
 *                             type: object
 *                             properties:
 *                               vendor_id:
 *                                 type: integer
 *                                 example: 3
 *                               shop_name:
 *                                 type: string
 *                                 example: Fresh Mart
 *                               owner_name:
 *                                 type: string
 *                                 example: Karthik R
 *                               mobile_number:
 *                                 type: string
 *                                 example: "9876543210"
 *                           created_at:
 *                             type: string
 *                             format: date-time
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                           example: 200
 *                         page:
 *                           type: integer
 *                           example: 1
 *                         limit:
 *                           type: integer
 *                           example: 20
 *                         total_pages:
 *                           type: integer
 *                           example: 10
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Internal server error
 */
router.get("/", ctrl.listOrders);

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/orders/:order_id
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /admin/orders/{order_id}:
 *   get:
 *     summary: Get full order detail with items, payments, vendor and cancellation info
 *     tags: [Admin Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: order_id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *     responses:
 *       200:
 *         description: Order fetched successfully
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
 *                   example: Order fetched successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     order_id:
 *                       type: integer
 *                       example: 1
 *                     order_number:
 *                       type: string
 *                       example: ORD-20260101-0001
 *                     order_date:
 *                       type: string
 *                       format: date-time
 *                     order_status:
 *                       type: string
 *                       example: confirmed
 *                     payment_status:
 *                       type: string
 *                       example: pending
 *                     subtotal_amount:
 *                       type: number
 *                       example: 1000.00
 *                     discount_percentage:
 *                       type: number
 *                       example: 5.00
 *                     discount_amount:
 *                       type: number
 *                       example: 50.00
 *                     tax_percentage:
 *                       type: number
 *                       example: 2.00
 *                     tax_amount:
 *                       type: number
 *                       example: 18.00
 *                     delivery_charges:
 *                       type: number
 *                       example: 30.00
 *                     final_amount:
 *                       type: number
 *                       example: 998.00
 *                     delivery_address:
 *                       type: string
 *                       example: 12 Market Street Chennai
 *                     delivery_latitude:
 *                       type: number
 *                       nullable: true
 *                       example: 13.0827
 *                     delivery_longitude:
 *                       type: number
 *                       nullable: true
 *                       example: 80.2707
 *                     expected_delivery_date:
 *                       type: string
 *                       format: date
 *                       nullable: true
 *                     actual_delivery_date:
 *                       type: string
 *                       format: date-time
 *                       nullable: true
 *                     special_instructions:
 *                       type: string
 *                       nullable: true
 *                     cancellation_reason:
 *                       type: string
 *                       nullable: true
 *                     cancelled_at:
 *                       type: string
 *                       format: date-time
 *                       nullable: true
 *                     cancelled_by:
 *                       type: object
 *                       nullable: true
 *                       properties:
 *                         user_id:
 *                           type: integer
 *                           example: 1
 *                         mobile_number:
 *                           type: string
 *                           example: "9876543210"
 *                     vendor:
 *                       type: object
 *                       properties:
 *                         vendor_id:
 *                           type: integer
 *                           example: 3
 *                         shop_name:
 *                           type: string
 *                           example: Fresh Mart
 *                         owner_name:
 *                           type: string
 *                           example: Karthik R
 *                         mobile_number:
 *                           type: string
 *                           example: "9876543210"
 *                         email:
 *                           type: string
 *                           example: karthik@freshmart.com
 *                     items:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           order_item_id:
 *                             type: integer
 *                             example: 5
 *                           product_id:
 *                             type: integer
 *                             example: 2
 *                           grade:
 *                             type: string
 *                             enum: [A, B, C]
 *                             example: A
 *                           quantity_kg:
 *                             type: number
 *                             example: 50.00
 *                           price_per_kg:
 *                             type: number
 *                             example: 20.00
 *                           total_price:
 *                             type: number
 *                             example: 1000.00
 *                           delivered_quantity_kg:
 *                             type: number
 *                             example: 0.00
 *                           status:
 *                             type: string
 *                             example: confirmed
 *                           product:
 *                             type: object
 *                             properties:
 *                               product_id:
 *                                 type: integer
 *                                 example: 2
 *                               product_name:
 *                                 type: string
 *                                 example: Tomato
 *                               product_code:
 *                                 type: string
 *                                 example: TOM001
 *                               unit:
 *                                 type: string
 *                                 example: kg
 *                     payments:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           payment_id:
 *                             type: integer
 *                             example: 1
 *                           payment_method:
 *                             type: string
 *                             example: razorpay
 *                           amount:
 *                             type: number
 *                             example: 998.00
 *                           payment_status:
 *                             type: string
 *                             example: success
 *                           transaction_id:
 *                             type: string
 *                             example: TXN123456
 *                           transaction_date:
 *                             type: string
 *                             format: date-time
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                     updated_at:
 *                       type: string
 *                       format: date-time
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Order not found
 *       500:
 *         description: Internal server error
 */
router.get("/:order_id", ctrl.getOrderById);

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/orders/:order_id/items
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /admin/orders/{order_id}/items:
 *   get:
 *     summary: Get line items for an order
 *     tags: [Admin Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: order_id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *     responses:
 *       200:
 *         description: Order items fetched successfully
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
 *                   example: Order items fetched successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     items:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           order_item_id:
 *                             type: integer
 *                             example: 5
 *                           order_id:
 *                             type: integer
 *                             example: 1
 *                           grade:
 *                             type: string
 *                             enum: [A, B, C]
 *                             example: A
 *                           quantity_kg:
 *                             type: number
 *                             example: 50.00
 *                           price_per_kg:
 *                             type: number
 *                             example: 20.00
 *                           total_price:
 *                             type: number
 *                             example: 1000.00
 *                           delivered_quantity_kg:
 *                             type: number
 *                             example: 0.00
 *                           status:
 *                             type: string
 *                             example: confirmed
 *                           product:
 *                             type: object
 *                             properties:
 *                               product_id:
 *                                 type: integer
 *                                 example: 2
 *                               product_name:
 *                                 type: string
 *                                 example: Tomato
 *                               product_code:
 *                                 type: string
 *                                 example: TOM001
 *                               unit:
 *                                 type: string
 *                                 example: kg
 *                               image_url:
 *                                 type: string
 *                                 nullable: true
 *                                 example: https://cdn.example.com/tomato.jpg
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Order not found
 *       500:
 *         description: Internal server error
 */
router.get("/:order_id/items", ctrl.getOrderItems);

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /admin/orders/:order_id/items/:order_item_id/status
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /admin/orders/{order_id}/items/{order_item_id}/status:
 *   patch:
 *     summary: Update individual order item status
 *     tags: [Admin Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: order_id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *       - in: path
 *         name: order_item_id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 5
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
 *                 enum: [pending, confirmed, delivered, cancelled]
 *                 example: delivered
 *     responses:
 *       200:
 *         description: Order item status updated successfully
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
 *                   example: Order item status updated successfully
 *       400:
 *         description: Missing or invalid status
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Order or order item not found
 *       500:
 *         description: Internal server error
 */
router.patch("/:order_id/items/:order_item_id/status", ctrl.updateOrderItemStatus);

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /admin/orders/:order_id/status
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /admin/orders/{order_id}/status:
 *   patch:
 *     summary: Update order status
 *     tags: [Admin Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: order_id
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
 *               - order_status
 *             properties:
 *               order_status:
 *                 type: string
 *                 enum: [confirmed, processing, ready, dispatched, delivered]
 *                 example: confirmed
 *     responses:
 *       200:
 *         description: Order status updated successfully
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
 *                   example: Order status updated successfully
 *       400:
 *         description: Missing or invalid order_status
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Order not found
 *       409:
 *         description: Cannot update status of a cancelled order
 *       500:
 *         description: Internal server error
 */
router.patch("/:order_id/status", ctrl.updateOrderStatus);

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /admin/orders/:order_id/cancel
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /admin/orders/{order_id}/cancel:
 *   patch:
 *     summary: Cancel an order with reason - releases reserved inventory automatically
 *     tags: [Admin Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: order_id
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
 *               - cancellation_reason
 *             properties:
 *               cancellation_reason:
 *                 type: string
 *                 example: Vendor requested cancellation due to stock unavailability
 *     responses:
 *       200:
 *         description: Order cancelled successfully
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
 *                   example: Order cancelled successfully
 *       400:
 *         description: Missing cancellation_reason
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Order not found
 *       409:
 *         description: Order is already cancelled or delivered
 *       500:
 *         description: Internal server error
 */
router.patch("/:order_id/cancel", ctrl.cancelOrder);

// ─────────────────────────────────────────────────────────────────────────────
// GET /admin/orders/:order_id/payments
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /admin/orders/{order_id}/payments:
 *   get:
 *     summary: Get payment records for an order
 *     tags: [Admin Orders]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: order_id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *     responses:
 *       200:
 *         description: Order payments fetched successfully
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
 *                   example: Order payments fetched successfully
 *                 data:
 *                   type: object
 *                   properties:
 *                     payments:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           payment_id:
 *                             type: integer
 *                             example: 1
 *                           payment_method:
 *                             type: string
 *                             enum: [razorpay, cash, bank_transfer, upi, card]
 *                             example: razorpay
 *                           amount:
 *                             type: number
 *                             example: 998.00
 *                           payment_status:
 *                             type: string
 *                             enum: [initiated, pending, success, failed, refunded]
 *                             example: success
 *                           razorpay_order_id:
 *                             type: string
 *                             nullable: true
 *                             example: order_ABC123
 *                           razorpay_payment_id:
 *                             type: string
 *                             nullable: true
 *                             example: pay_XYZ789
 *                           transaction_id:
 *                             type: string
 *                             nullable: true
 *                             example: TXN123456
 *                           transaction_date:
 *                             type: string
 *                             format: date-time
 *                           failure_reason:
 *                             type: string
 *                             nullable: true
 *                           refund_amount:
 *                             type: number
 *                             example: 0.00
 *                           refund_date:
 *                             type: string
 *                             format: date-time
 *                             nullable: true
 *                           created_at:
 *                             type: string
 *                             format: date-time
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Order not found
 *       500:
 *         description: Internal server error
 */
router.get("/:order_id/payments", ctrl.getOrderPayments);

module.exports = router;