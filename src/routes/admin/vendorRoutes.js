const router = require("express").Router();
const ctrl   = require("../../controllers/admin/vendorController");
const { verifyAdminToken } = require("../../middleware/adminAuth");

router.use(verifyAdminToken);

/**
 * @swagger
 * /admin/vendors:
 *   get:
 *     summary: Get all vendors
 *     description: |
 *       Returns a paginated list of all vendors with optional filters:
 *       - Search by shop name, owner name, or GST number
 *       - Filter by business type, active status, state, district, city
 *     tags: [Admin Vendors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *         description: Records per page
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Search by shop name, owner name, or GST number
 *       - in: query
 *         name: business_type
 *         schema:
 *           type: string
 *           enum: [retail, restaurant, hotel, wholesale, other]
 *         description: Filter by business type
 *       - in: query
 *         name: is_active
 *         schema: { type: boolean }
 *         description: Filter by active/inactive status
 *       - in: query
 *         name: state_id
 *         schema: { type: integer }
 *       - in: query
 *         name: district_id
 *         schema: { type: integer }
 *       - in: query
 *         name: city_id
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Paginated vendor list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     vendors:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           vendor_id:       { type: integer }
 *                           shop_name:       { type: string }
 *                           owner_name:      { type: string }
 *                           business_type:   { type: string }
 *                           primary_address: { type: string }
 *                           gst_number:      { type: string }
 *                           total_orders:    { type: integer }
 *                           state_info:      { type: object }
 *                           district_info:   { type: object }
 *                           city_info:       { type: object }
 *                           user:
 *                             type: object
 *                             properties:
 *                               mobile_number: { type: string }
 *                               email:         { type: string }
 *                               is_active:     { type: boolean }
 *                               is_verified:   { type: boolean }
 *                               created_at:    { type: string, format: date-time }
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         total:        { type: integer }
 *                         total_pages:  { type: integer }
 *                         current_page: { type: integer }
 *                         per_page:     { type: integer }
 */
router.get("/", ctrl.getAllVendors);

/**
 * @swagger
 * /admin/vendors/{id}:
 *   get:
 *     summary: Get single vendor details
 *     description: |
 *       Returns full vendor profile including:
 *       - Shop & owner info
 *       - Location details (state, district, city)
 *       - All active delivery addresses
 *       - Summary stats (total orders, total revenue, pending orders)
 *       - Linked user account details
 *     tags: [Admin Vendors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         description: Vendor ID
 *     responses:
 *       200:
 *         description: Vendor details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     vendor_id:        { type: integer }
 *                     shop_name:        { type: string }
 *                     owner_name:       { type: string }
 *                     vendor_photo_url: { type: string }
 *                     shop_photo_url:   { type: string }
 *                     gst_number:       { type: string }
 *                     business_type:    { type: string }
 *                     primary_address:  { type: string }
 *                     pincode:          { type: string }
 *                     latitude:         { type: number }
 *                     longitude:        { type: number }
 *                     state_info:       { type: object }
 *                     district_info:    { type: object }
 *                     city_info:        { type: object }
 *                     addresses:
 *                       type: array
 *                       items: { type: object }
 *                     user:
 *                       type: object
 *                       properties:
 *                         mobile_number: { type: string }
 *                         email:         { type: string }
 *                         is_active:     { type: boolean }
 *                         is_verified:   { type: boolean }
 *                         last_login:    { type: string, format: date-time }
 *                         created_at:    { type: string, format: date-time }
 *                     stats:
 *                       type: object
 *                       properties:
 *                         total_orders:   { type: integer }
 *                         total_revenue:  { type: number }
 *                         pending_orders: { type: integer }
 *       404:
 *         description: Vendor not found
 */
router.get("/:id", ctrl.getVendorById);

/**
 * @swagger
 * /admin/vendors/{id}/activate:
 *   patch:
 *     summary: Activate a vendor
 *     description: |
 *       Activates the vendor's user account (sets `is_active = true`).
 *       Vendor can now log in and access their dashboard.
 *     tags: [Admin Vendors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         description: Vendor ID
 *     responses:
 *       200:
 *         description: Vendor activated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 message: { type: string, example: "Vendor activated successfully" }
 *                 data:
 *                   type: object
 *                   properties:
 *                     vendor_id: { type: integer }
 *                     is_active: { type: boolean, example: true }
 *       400:
 *         description: Vendor has no associated user / Already active
 *       404:
 *         description: Vendor not found
 */
router.patch("/:id/activate", ctrl.activateVendor);

/**
 * @swagger
 * /admin/vendors/{id}/deactivate:
 *   patch:
 *     summary: Deactivate a vendor
 *     description: |
 *       Deactivates the vendor's user account (sets `is_active = false`).
 *       Vendor will no longer be able to log in or access their dashboard.
 *     tags: [Admin Vendors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         description: Vendor ID
 *     responses:
 *       200:
 *         description: Vendor deactivated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 message: { type: string, example: "Vendor deactivated successfully" }
 *                 data:
 *                   type: object
 *                   properties:
 *                     vendor_id: { type: integer }
 *                     is_active: { type: boolean, example: false }
 *       400:
 *         description: Vendor has no associated user / Already inactive
 *       404:
 *         description: Vendor not found
 */
router.patch("/:id/deactivate", ctrl.deactivateVendor);

/**
 * @swagger
 * /admin/vendors/{id}/orders:
 *   get:
 *     summary: Get all orders of a vendor
 *     description: |
 *       Returns paginated orders for a specific vendor including:
 *       - Order items with product details
 *       - Linked payment info per order
 *       - Filterable by order status and payment status
 *     tags: [Admin Vendors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         description: Vendor ID
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: order_status
 *         schema:
 *           type: string
 *           enum: [placed, confirmed, processing, ready, dispatched, delivered, cancelled, returned]
 *       - in: query
 *         name: payment_status
 *         schema:
 *           type: string
 *           enum: [pending, paid, partial, failed, refunded]
 *     responses:
 *       200:
 *         description: Vendor orders
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     orders:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           order_id:       { type: integer }
 *                           order_number:   { type: string }
 *                           order_status:   { type: string }
 *                           payment_status: { type: string }
 *                           final_amount:   { type: number }
 *                           order_date:     { type: string, format: date-time }
 *                           order_items:    { type: array, items: { type: object } }
 *                           payment:        { type: object }
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         total:        { type: integer }
 *                         total_pages:  { type: integer }
 *                         current_page: { type: integer }
 *                         per_page:     { type: integer }
 *       404:
 *         description: Vendor not found
 */
router.get("/:id/orders", ctrl.getVendorOrders);

/**
 * @swagger
 * /admin/vendors/{id}/payments:
 *   get:
 *     summary: Get all payments of a vendor
 *     description: |
 *       Returns paginated payment records for a specific vendor including:
 *       - Linked order info per payment
 *       - Summary (total success amount, failed count, refunded amount)
 *       - Filterable by payment status and payment method
 *     tags: [Admin Vendors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         description: Vendor ID
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: payment_status
 *         schema:
 *           type: string
 *           enum: [initiated, pending, success, failed, refunded]
 *       - in: query
 *         name: payment_method
 *         schema:
 *           type: string
 *           enum: [razorpay, cash, bank_transfer, upi, card]
 *     responses:
 *       200:
 *         description: Vendor payments
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     payments:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           payment_id:       { type: integer }
 *                           payment_method:   { type: string }
 *                           payment_status:   { type: string }
 *                           amount:           { type: number }
 *                           transaction_date: { type: string, format: date-time }
 *                           order:            { type: object }
 *                     summary:
 *                       type: object
 *                       properties:
 *                         total_success_amount:  { type: number }
 *                         total_failed_count:    { type: integer }
 *                         total_refunded_amount: { type: number }
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         total:        { type: integer }
 *                         total_pages:  { type: integer }
 *                         current_page: { type: integer }
 *                         per_page:     { type: integer }
 *       404:
 *         description: Vendor not found
 */
router.get("/:id/payments", ctrl.getVendorPayments);

/**
 * @swagger
 * /admin/vendors/{id}/addresses:
 *   get:
 *     summary: Get all delivery addresses of a vendor
 *     description: |
 *       Returns all saved addresses for a vendor.
 *       Default address is listed first.
 *     tags: [Admin Vendors]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         description: Vendor ID
 *     responses:
 *       200:
 *         description: Vendor addresses
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     addresses:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           address_id:     { type: integer }
 *                           address_label:  { type: string }
 *                           address_line1:  { type: string }
 *                           address_line2:  { type: string }
 *                           landmark:       { type: string }
 *                           city:           { type: string }
 *                           state:          { type: string }
 *                           pincode:        { type: string }
 *                           contact_person: { type: string }
 *                           contact_number: { type: string }
 *                           is_default:     { type: boolean }
 *                           latitude:       { type: number }
 *                           longitude:      { type: number }
 *       404:
 *         description: Vendor not found
 */
router.get("/:id/addresses", ctrl.getVendorAddresses);

module.exports = router;