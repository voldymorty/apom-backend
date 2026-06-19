// cartRoutes.js

const router = require("express").Router();
const ctrl = require("../../controllers/vendor/cartController");
const { authenticate } = require("../../middleware/auth");

/**
 * @swagger
 * /vendor/cart:
 *   get:
 *     summary: Get current cart with summary (subtotal, tax, delivery, grand total)
 *     tags: [Vendor Cart]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cart items and pricing summary
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 items:
 *                   - cart_key: "1_2"
 *                     product_name: "Organic Roma Tomatoes"
 *                     grade: "A"
 *                     price_per_unit: 12.00
 *                     unit: "kg"
 *                     quantity: 5
 *                     total_price: 60.00
 *                 item_count: 3
 *                 summary:
 *                   subtotal: 155.50
 *                   delivery_charges: 15.00
 *                   tax_rate: 5
 *                   tax_amount: 7.78
 *                   grand_total: 178.28
 */
router.get("/", authenticate, ctrl.getCart);

/**
 * @swagger
 * /vendor/cart/add:
 *   post:
 *     summary: Add item to cart
 *     tags: [Vendor Cart]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [product_id, pricing_id]
 *             properties:
 *               product_id:  { type: integer }
 *               pricing_id:  { type: integer, description: "Pricing ID for the selected grade" }
 *               quantity:    { type: number, default: 1, description: "Quantity in kg" }
 *     responses:
 *       200:
 *         description: Updated cart
 */
router.post("/add", authenticate, ctrl.addToCart);

/**
 * @swagger
 * /vendor/cart/update:
 *   put:
 *     summary: Update cart item quantity (0 = remove)
 *     tags: [Vendor Cart]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [cart_key, quantity]
 *             properties:
 *               cart_key: { type: string, example: "1_2" }
 *               quantity: { type: number, description: "New quantity. 0 or negative = remove item" }
 *     responses:
 *       200:
 *         description: Updated cart
 */
router.put("/update", authenticate, ctrl.updateCartItem);

/**
 * @swagger
 * /vendor/cart/remove/{cart_key}:
 *   delete:
 *     summary: Remove single item from cart
 *     tags: [Vendor Cart]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: cart_key
 *         required: true
 *         schema: { type: string }
 *         example: "1_2"
 *     responses:
 *       200:
 *         description: Item removed
 */
router.delete("/remove/:cart_key", authenticate, ctrl.removeCartItem);

/**
 * @swagger
 * /vendor/cart/clear:
 *   delete:
 *     summary: Clear all items from cart
 *     tags: [Vendor Cart]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cart cleared
 */
router.delete("/clear", authenticate, ctrl.clearCart);

/**
 * @swagger
 * /vendor/cart/checkout:
 *   post:
 *     summary: Place order from cart (Proceed to Checkout)
 *     description: |
 *       Creates an order from current cart items and clears the cart.
 *       Calculates: subtotal + delivery charges (₹15) + 5% tax = grand total
 *     tags: [Vendor Cart]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [delivery_address]
 *             properties:
 *               delivery_address:    { type: string, example: "12, MG Road, Coimbatore" }
 *               delivery_address_id: { type: integer, description: "Optional saved address ID" }
 *               special_instructions: { type: string }
 *     responses:
 *       201:
 *         description: Order placed successfully with order_id and order_number
 *       400:
 *         description: Cart is empty or validation error
 */
router.post("/checkout", authenticate, ctrl.checkout);

module.exports = router;
