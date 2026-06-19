const router = require("express").Router();
const ctrl = require("../../controllers/vendor/productController");
const { authenticate } = require("../../middleware/auth");

/**
 * @swagger
 * /vendor/products/categories:
 *   get:
 *     summary: Get all active categories for the category chip filter
 *     tags: [Vendor Products]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of categories
 */
router.get("/categories", authenticate, ctrl.getCategories);

/**
 * @swagger
 * /vendor/products:
 *   get:
 *     summary: Browse products with search, filter by category/grade, and sort
 *     tags: [Vendor Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category_id
 *         schema: { type: integer }
 *         description: Filter by category
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Search by product name
 *       - in: query
 *         name: sort
 *         schema: { type: string, enum: [recommended, price_asc, price_desc] }
 *         description: Sort order (default recommended)
 *       - in: query
 *         name: grade
 *         schema: { type: string, enum: [A, B, C] }
 *         description: Filter by grade (A=GRADE A premium)
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Paginated product list with grade/pricing info
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 products:
 *                   - product_id: 1
 *                     product_name: "Organic Tomatoes"
 *                     unit: "kg"
 *                     image_url: "http://..."
 *                     category_name: "Vegetables"
 *                     grade: "A"
 *                     tag: "GRADE A"
 *                     price_per_unit: 2.45
 *                     min_order_kg: 10
 */
router.get("/", authenticate, ctrl.getProducts);

/**
 * @swagger
 * /vendor/products/{product_id}:
 *   get:
 *     summary: Get product detail with all grades and pricing
 *     tags: [Vendor Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: product_id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Product detail with grade options
 *       404:
 *         description: Product not found
 */
router.get("/:product_id", authenticate, ctrl.getProductDetail);

module.exports = router;
