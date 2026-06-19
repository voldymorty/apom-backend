const router  = require("express").Router();
const ctrl    = require("../../controllers/admin/ProductController");
const { verifyAdminToken } = require("../../middleware/adminAuth");
const multer  = require("multer");
const path    = require("path");
const fs      = require("fs");

// ─── Multer: categories ───────────────────────────────────────
const categoryStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "../../uploads/categories");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}_${file.originalname.replace(/\s+/g, "_")}`);
  },
});
const uploadCategory = multer({
  storage: categoryStorage,
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error("Only JPEG, PNG and WEBP images are allowed"));
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
}).fields([{ name: "image", maxCount: 1 }, { name: "icon", maxCount: 1 }]);

// ─── Multer: products ─────────────────────────────────────────
const productStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "../../uploads/products");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}_${file.originalname.replace(/\s+/g, "_")}`);
  },
});
const uploadProduct = multer({
  storage: productStorage,
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error("Only JPEG, PNG and WEBP images are allowed"));
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
}).single("image");

const admin = [verifyAdminToken];

// ════════════════════════════════════════════════════════════════
//  CATEGORIES
// ════════════════════════════════════════════════════════════════

/**
 * @swagger
 * /admin/products/categories:
 *   get:
 *     summary: Get all categories
 *     description: Returns all product categories. Optionally filter by active status.
 *     tags: [Admin Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: is_active
 *         schema: { type: boolean }
 *         description: Filter by active/inactive status
 *     responses:
 *       200:
 *         description: List of categories
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     categories:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           category_id:   { type: integer }
 *                           category_name: { type: string }
 *                           category_code: { type: string }
 *                           description:   { type: string }
 *                           image_url:     { type: string }
 *                           icon_url:      { type: string }
 *                           is_active:     { type: boolean }
 *                           display_order: { type: integer }
 */
router.get("/categories", ...admin, ctrl.getAllCategories);

/**
 * @swagger
 * /admin/products/categories:
 *   post:
 *     summary: Create a new category
 *     description: |
 *       Creates a new product category.
 *       Accepts multipart/form-data with optional image and icon uploads.
 *     tags: [Admin Products]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [category_name, category_code]
 *             properties:
 *               category_name: { type: string }
 *               category_code: { type: string }
 *               description:   { type: string }
 *               display_order: { type: integer }
 *               image:         { type: string, format: binary }
 *               icon:          { type: string, format: binary }
 *     responses:
 *       201:
 *         description: Category created
 *       409:
 *         description: Category name or code already exists
 */
router.post("/categories", ...admin, uploadCategory, ctrl.createCategory);

/**
 * @swagger
 * /admin/products/categories/{id}:
 *   put:
 *     summary: Update a category
 *     description: Updates category fields. All fields are optional. Replaces image/icon if uploaded.
 *     tags: [Admin Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               category_name: { type: string }
 *               category_code: { type: string }
 *               description:   { type: string }
 *               display_order: { type: integer }
 *               is_active:     { type: boolean }
 *               image:         { type: string, format: binary }
 *               icon:          { type: string, format: binary }
 *     responses:
 *       200:
 *         description: Category updated
 *       404:
 *         description: Category not found
 */
router.put("/categories/:id", ...admin, uploadCategory, ctrl.updateCategory);

/**
 * @swagger
 * /admin/products/categories/{id}:
 *   delete:
 *     summary: Deactivate a category (soft delete)
 *     tags: [Admin Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Category deactivated successfully
 *       404:
 *         description: Category not found
 */
router.delete("/categories/:id", ...admin, ctrl.deleteCategory);

// ════════════════════════════════════════════════════════════════
//  PRODUCTS
// ════════════════════════════════════════════════════════════════

/**
 * @swagger
 * /admin/products:
 *   get:
 *     summary: Get all products
 *     description: |
 *       Returns a lean paginated list of products.
 *       No nested inventory or pricing arrays — use GET /admin/products/:id for full detail.
 *       Each product includes:
 *       - current_stock_kg: total available stock across all grades
 *       - grade_stock: per-grade breakdown { A, B, C }
 *       - active_pricing_count: number of active pricing records
 *     tags: [Admin Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Search by product name
 *       - in: query
 *         name: category_id
 *         schema: { type: integer }
 *       - in: query
 *         name: is_active
 *         schema: { type: boolean }
 *       - in: query
 *         name: is_seasonal
 *         schema: { type: boolean }
 *     responses:
 *       200:
 *         description: Paginated lean product list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     products:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           product_id:           { type: integer }
 *                           product_name:         { type: string }
 *                           product_code:         { type: string }
 *                           unit:                 { type: string }
 *                           image_url:            { type: string }
 *                           is_seasonal:          { type: boolean }
 *                           is_active:            { type: boolean }
 *                           created_at:           { type: string, format: date-time }
 *                           category:             { type: object }
 *                           current_stock_kg:     { type: number, example: 450.00 }
 *                           grade_stock:
 *                             type: object
 *                             example: { A: 200, B: 150, C: 100 }
 *                           active_pricing_count: { type: integer, example: 3 }
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         total:        { type: integer }
 *                         total_pages:  { type: integer }
 *                         current_page: { type: integer }
 *                         per_page:     { type: integer }
 */
router.get("/", ...admin, ctrl.getAllProducts);

/**
 * @swagger
 * /admin/products:
 *   post:
 *     summary: Create a new product
 *     description: |
 *       Creates a product with an optional product image.
 *       Optionally accepts initial inventory and pricing entries per grade in the request body.
 *       Body should be sent as multipart/form-data.
 *       For inventory and pricing arrays, send as JSON string or use indexed form fields.
 *     tags: [Admin Products]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [category_id, product_name, product_code]
 *             properties:
 *               category_id:        { type: integer }
 *               product_name:       { type: string }
 *               product_code:       { type: string }
 *               description:        { type: string }
 *               unit:               { type: string, enum: [kg, piece, bunch, dozen, gram] }
 *               is_seasonal:        { type: boolean }
 *               season_start_month: { type: integer }
 *               season_end_month:   { type: integer }
 *               image:              { type: string, format: binary }
 *               inventory:
 *                 type: string
 *                 description: |
 *                   JSON string array of inventory per grade.
 *                   Example: [{"grade":"A","available_quantity_kg":100,"warehouse_location":"Rack-1","minimum_stock_alert":20}]
 *               pricing:
 *                 type: string
 *                 description: |
 *                   JSON string array of pricing per grade.
 *                   Example: [{"grade":"A","base_price_per_kg":30,"wholesale_price_per_kg":45,"effective_from":"2025-01-01"}]
 *     responses:
 *       201:
 *         description: Product created with nested inventory and pricing
 *       409:
 *         description: Product code already exists
 */
router.post("/", ...admin, uploadProduct, ctrl.createProduct);

/**
 * @swagger
 * /admin/products/{id}:
 *   put:
 *     summary: Update a product
 *     description: |
 *       Updates product fields. All fields optional.
 *       To update inventory or pricing, use their dedicated endpoints.
 *     tags: [Admin Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               category_id:        { type: integer }
 *               product_name:       { type: string }
 *               product_code:       { type: string }
 *               description:        { type: string }
 *               unit:               { type: string }
 *               is_seasonal:        { type: boolean }
 *               season_start_month: { type: integer }
 *               season_end_month:   { type: integer }
 *               is_active:          { type: boolean }
 *               image:              { type: string, format: binary }
 *     responses:
 *       200:
 *         description: Product updated
 *       404:
 *         description: Product not found
 */
router.put("/:id", ...admin, uploadProduct, ctrl.updateProduct);

/**
 * @swagger
 * /admin/products/{id}:
 *   delete:
 *     summary: Deactivate a product (soft delete)
 *     tags: [Admin Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Product deactivated successfully
 *       404:
 *         description: Product not found
 */
router.delete("/:id", ...admin, ctrl.deleteProduct);

/**
 * @swagger
 * /admin/products/{id}:
 *   get:
 *     summary: Get single product details
 *     description: Returns full product info with all inventory records and all pricing (active & inactive).
 *     tags: [Admin Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Product details with nested inventory and pricing
 *       404:
 *         description: Product not found
 */
router.get("/:id", ...admin, ctrl.getProductById);

module.exports = router;