const router  = require("express").Router();
const ctrl    = require("../../controllers/admin/ProductController");
const { verifyAdminToken } = require("../../middleware/adminAuth");
const path    = require("path");
const fs      = require("fs");

const admin = [verifyAdminToken];

// ════════════════════════════════════════════════════════════════
//  PRICING
// ════════════════════════════════════════════════════════════════

/**
 * @swagger
 * /admin/pricing:
 *   get:
 *     summary: Get all pricing records
 *     description: Returns paginated pricing records with nested product and category info.
 *     tags: [Admin Pricing]
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
 *         name: product_id
 *         schema: { type: integer }
 *       - in: query
 *         name: grade
 *         schema: { type: string, enum: [A, B, C] }
 *       - in: query
 *         name: is_active
 *         schema: { type: boolean }
 *     responses:
 *       200:
 *         description: Paginated pricing list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     pricing:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           pricing_id:             { type: integer }
 *                           grade:                  { type: string }
 *                           base_price_per_kg:      { type: number }
 *                           wholesale_price_per_kg: { type: number }
 *                           retail_price_per_kg:    { type: number }
 *                           minimum_order_kg:       { type: number }
 *                           effective_from:         { type: string, format: date }
 *                           effective_to:           { type: string, format: date }
 *                           is_active:              { type: boolean }
 *                           product:                { type: object }
 *                     pagination:
 *                       type: object
 */
router.get("/", ...admin, ctrl.getAllPricing);

/**
 * @swagger
 * /admin/pricing:
 *   post:
 *     summary: Create or update pricing for a product + grade
 *     description: |
 *       Upserts pricing for a product and grade combination.
 *       - If no pricing exists for this product+grade → creates a new record
 *       - If pricing already exists → updates it (no duplicates)
 *
 *       **Inventory rule:** If no inventory record exists for the given product+grade,
 *       `available_quantity_kg` becomes required. `warehouse_location` and
 *       `minimum_stock_alert` are optional in that case. If inventory already exists,
 *       all three inventory fields are ignored.
 *     tags: [Admin Pricing]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [product_id, grade, base_price_per_kg, wholesale_price_per_kg, effective_from]
 *             properties:
 *               product_id:             { type: integer }
 *               grade:                  { type: string, enum: [A, B, C] }
 *               base_price_per_kg:      { type: number, description: "Purchase price from farmer" }
 *               wholesale_price_per_kg: { type: number, description: "Selling price to vendor" }
 *               retail_price_per_kg:    { type: number, description: "Suggested retail price (optional)" }
 *               minimum_order_kg:       { type: number, default: 10 }
 *               effective_from:         { type: string, format: date }
 *               effective_to:           { type: string, format: date, description: "Leave null for open-ended" }
 *               available_quantity_kg:
 *                 type: number
 *                 description: "Required when no inventory exists yet for this product+grade. Ignored if inventory already exists."
 *               warehouse_location:
 *                 type: string
 *                 description: "Optional. Only used when initialising a new inventory record."
 *               minimum_stock_alert:
 *                 type: number
 *                 default: 50
 *                 description: "Optional. Only used when initialising a new inventory record."
 *     responses:
 *       201:
 *         description: Pricing created (and inventory initialised if it did not exist)
 *       200:
 *         description: Pricing updated
 *       400:
 *         description: available_quantity_kg missing when inventory does not exist for this grade
 *       404:
 *         description: Product not found
 */
router.post("/", ...admin, ctrl.upsertPricing);

/**
 * @swagger
 * /admin/pricing/{id}:
 *   delete:
 *     summary: Deactivate a pricing record (soft delete)
 *     tags: [Admin Pricing]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Pricing deactivated successfully
 *       404:
 *         description: Pricing record not found
 */
router.delete("/:id", ...admin, ctrl.deletePricing);

module.exports = router;