const router = require("express").Router();
const ctrl = require("../../controllers/farmer/farmerCropController");
const { authenticate, authorizeRoles } = require("../../middleware/auth");
const { requireActiveSubscription } = require("../../middleware/subscriptionGate");

/**
 * @swagger
 * /farmer-crops/categories:
 *   get:
 *     summary: Get all active categories with their products (for Flutter dropdowns)
 *     tags: [Farmer Crops]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Categories with nested product list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       category_id:   { type: integer }
 *                       category_name: { type: string }
 *                       category_code: { type: string }
 *                       icon_url:      { type: string }
 *                       products:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             product_id:   { type: integer }
 *                             product_name: { type: string }
 *                             unit:         { type: string }
 */
router.get("/categories", authenticate, authorizeRoles("farmer"), ctrl.getCategoriesWithProducts);

// /**
//  * @swagger
//  * /farmer-crops/all:
//  *   get:
//  *     summary: Get all crops (admin only)
//  *     tags: [Farmer Crops]
//  *     security:
//  *       - bearerAuth: []
//  *     parameters:
//  *       - in: query
//  *         name: page
//  *         schema: { type: integer, default: 1 }
//  *       - in: query
//  *         name: limit
//  *         schema: { type: integer, default: 20 }
//  *       - in: query
//  *         name: status
//  *         schema: { type: string, enum: [available, pickup_assigned, picked_up, cancelled] }
//  *       - in: query
//  *         name: farmer_id
//  *         schema: { type: integer }
//  *       - in: query
//  *         name: product_id
//  *         schema: { type: integer }
//  *     responses:
//  *       200:
//  *         description: Paginated list of all crops
//  */
// router.get("/all", authenticate, authorizeRoles("admin"), ctrl.getAllCrops);

/**
 * @swagger
 * /farmer-crops:
 *   get:
 *     summary: Get logged-in farmer's crops
 *     tags: [Farmer Crops]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [available, pickup_assigned, picked_up, cancelled]
 *         description: Filter by crop status. Leave empty to get all.
 *     responses:
 *       200:
 *         description: List of farmer's crops with product and category info
 */
router.get("/", authenticate, authorizeRoles("farmer"), requireActiveSubscription, ctrl.getMyCrops);

/**
 * @swagger
 * /farmer-crops/{crop_id}:
 *   get:
 *     summary: Get crop details by ID
 *     tags: [Farmer Crops]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: crop_id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Crop details
 *       404:
 *         description: Crop not found
 */
router.get("/:crop_id", authenticate, ctrl.getCropById);

/**
 * @swagger
 * /farmer-crops:
 *   post:
 *     summary: Add a new crop listing
 *     tags: [Farmer Crops]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [product_id, quantity_kg, expected_price_per_kg, grade, available_date]
 *             properties:
 *               product_id:
 *                 type: integer
 *                 description: ID from /farmer-crops/categories products list
 *               quantity_kg:
 *                 type: number
 *                 example: 100
 *               expected_price_per_kg:
 *                 type: number
 *                 example: 25.50
 *               grade:
 *                 type: string
 *                 enum: [A, B, C]
 *                 example: A
 *               available_date:
 *                 type: string
 *                 format: date
 *                 example: "2025-06-01"
 *               remarks:
 *                 type: string
 *               crop_photos:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: 1 to 3 crop images
 *     responses:
 *       201:
 *         description: Crop submitted for admin approval
 *       400:
 *         description: Invalid grade
 *       404:
 *         description: Farmer or product not found
 */
router.post("/", authenticate, authorizeRoles("farmer"), requireActiveSubscription, ctrl.uploadCropPhotos, ctrl.addCrop);

/**
 * @swagger
 * /farmer-crops/{crop_id}:
 *   put:
 *     summary: Update crop details
 *     tags: [Farmer Crops]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: crop_id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               product_id:            { type: integer }
 *               quantity_kg:           { type: number }
 *               expected_price_per_kg: { type: number }
 *               grade:                 { type: string, enum: [A, B, C] }
 *               available_date:        { type: string, format: date }
 *               remarks:               { type: string }
 *               crop_photos:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *                 description: New photos to add (merged with existing, max 3 total)
 *     responses:
 *       200:
 *         description: Crop updated
 *       404:
 *         description: Crop not found
 */
router.put("/:crop_id", authenticate, authorizeRoles("farmer"), requireActiveSubscription, ctrl.uploadCropPhotos, ctrl.updateCrop);

/**
 * @swagger
 * /farmer-crops/{crop_id}:
 *   delete:
 *     summary: Delete a crop listing
 *     tags: [Farmer Crops]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: crop_id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Crop deleted
 *       400:
 *         description: Cannot delete assigned or picked up crop
 */
router.delete("/:crop_id", authenticate, authorizeRoles("farmer"), ctrl.deleteCrop);

module.exports = router;