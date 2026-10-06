const router = require("express").Router();
const ctrl = require("../../controllers/farmer/farmerLandController");
const { authenticate, authorizeRoles } = require("../../middleware/auth");

/**
 * @swagger
 * /farmer-land:
 *   get:
 *     summary: Get all land segments for the logged-in farmer
 *     tags: [Farmer Land]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, fallow, harvested]
 *         description: Filter by segment status. Leave empty to get all segments.
 *     responses:
 *       200:
 *         description: List of land segments
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 total:   { type: integer }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       segment_id:      { type: integer }
 *                       farmer_id:       { type: integer }
 *                       product_id:      { type: integer, nullable: true }
 *                       crop_name:       { type: string, description: "Snapshot of the selected product's name" }
 *                       area_value:      { type: number }
 *                       area_unit:       { type: string, enum: [acres, hectares, cent] }
 *                       expected_yield_value: { type: number, nullable: true }
 *                       expected_yield_unit:  { type: string, enum: [kg, ton], nullable: true }
 *                       plantation_date: { type: string, format: date }
 *                       harvesting_date: { type: string, format: date }
 *                       status:          { type: string, enum: [active, fallow, harvested] }
 *       400:
 *         description: Invalid status value
 *       404:
 *         description: Farmer not found
 */
router.get("/", authenticate, authorizeRoles("farmer"), ctrl.getAll);

/**
 * @swagger
 * /farmer-land:
 *   post:
 *     summary: Add a new land segment
 *     tags: [Farmer Land]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [product_id, area_value, plantation_date, harvesting_date]
 *             properties:
 *               product_id:
 *                 type: integer
 *                 description: ID from GET /farmer-crops/categories products list
 *                 example: 12
 *               area_value:
 *                 type: number
 *                 example: 2.5
 *               area_unit:
 *                 type: string
 *                 enum: [acres, hectares, cent]
 *                 example: "acres"
 *               expected_yield_value:
 *                 type: number
 *                 example: 8
 *               expected_yield_unit:
 *                 type: string
 *                 enum: [kg, ton]
 *                 default: kg
 *                 example: "ton"
 *               plantation_date:
 *                 type: string
 *                 format: date
 *                 example: "2025-01-01"
 *               harvesting_date:
 *                 type: string
 *                 format: date
 *                 example: "2025-06-01"
 *               status:
 *                 type: string
 *                 enum: [active, fallow, harvested]
 *                 default: active
 *                 example: "active"
 *     responses:
 *       201:
 *         description: Land segment created
 *       400:
 *         description: Invalid status/product_id/yield unit, or area exceeds available total land
 *       404:
 *         description: Farmer not found
 */
router.post("/", authenticate, authorizeRoles("farmer"), ctrl.create);

/**
 * @swagger
 * /farmer-land/{id}:
 *   put:
 *     summary: Update a land segment
 *     tags: [Farmer Land]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         description: segment_id of the land segment to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               product_id:
 *                 type: integer
 *                 description: ID from GET /farmer-crops/categories products list
 *               area_value:
 *                 type: number
 *               area_unit:
 *                 type: string
 *                 enum: [acres, hectares, cent]
 *               expected_yield_value:
 *                 type: number
 *               expected_yield_unit:
 *                 type: string
 *                 enum: [kg, ton]
 *               plantation_date:
 *                 type: string
 *                 format: date
 *               harvesting_date:
 *                 type: string
 *                 format: date
 *               status:
 *                 type: string
 *                 enum: [active, fallow, harvested]
 *                 example: "harvested"
 *     responses:
 *       200:
 *         description: Land segment updated
 *       400:
 *         description: Invalid status/product_id/yield unit, or updated area exceeds available total land
 *       404:
 *         description: Segment or farmer not found
 */
router.put("/:id", authenticate, authorizeRoles("farmer"), ctrl.update);

/**
 * @swagger
 * /farmer-land/{id}:
 *   delete:
 *     summary: Delete a land segment
 *     tags: [Farmer Land]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         description: segment_id of the land segment to delete
 *     responses:
 *       200:
 *         description: Land segment deleted and farmer allocated land updated
 *       404:
 *         description: Segment or farmer not found
 */
router.delete("/:id", authenticate, authorizeRoles("farmer"), ctrl.delete);

module.exports = router;