const router  = require("express").Router();
const ctrl    = require("../../controllers/admin/ProductController");
const { verifyAdminToken } = require("../../middleware/adminAuth");
const path    = require("path");
const fs      = require("fs");

const admin = [verifyAdminToken];

// ════════════════════════════════════════════════════════════════
//  INVENTORY
// ════════════════════════════════════════════════════════════════

/**
 * @swagger
 * /admin/inventory/low-stock:
 *   get:
 *     summary: Get low stock inventory items
 *     description: Returns all inventory records where available_quantity_kg is below minimum_stock_alert.
 *     tags: [Admin Inventory]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Low stock items
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     count:     { type: integer }
 *                     inventory: { type: array, items: { type: object } }
 */
router.get("/low-stock", ...admin, ctrl.getLowStockInventory);

/**
 * @swagger
 * /admin/inventory:
 *   get:
 *     summary: Get all inventory records
 *     description: |
 *       Returns paginated inventory records with nested product and category info.
 *       Filterable by grade and category.
 *     tags: [Admin Inventory]
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
 *         name: grade
 *         schema: { type: string, enum: [A, B, C] }
 *       - in: query
 *         name: category_id
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Paginated inventory list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     inventory:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           inventory_id:          { type: integer }
 *                           grade:                 { type: string }
 *                           available_quantity_kg: { type: number }
 *                           reserved_quantity_kg:  { type: number }
 *                           minimum_stock_alert:   { type: number }
 *                           warehouse_location:    { type: string }
 *                           last_restocked_at:     { type: string, format: date-time }
 *                           product:               { type: object }
 *                     pagination:
 *                       type: object
 */
router.get("/", ...admin, ctrl.getAllInventory);

/**
 * @swagger
 * /admin/inventory/{id}:
 *   get:
 *     summary: Get a single inventory record
 *     description: Returns one inventory record with nested product and category info.
 *     tags: [Admin Inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: Inventory UUID
 *     responses:
 *       200:
 *         description: Inventory record found
 *       404:
 *         description: Inventory record not found
 */
router.get("/:id", ...admin, ctrl.getInventoryById);

/**
 * @swagger
 * /admin/inventory/{id}:
 *   patch:
 *     summary: Update inventory stock
 *     description: |
 *       Updates the available stock for an inventory record and auto-creates a transaction log.
 *       Transaction types:
 *       - stock_in / return → adds to available_quantity_kg
 *       - stock_out / wastage → subtracts from available_quantity_kg
 *       - adjustment → sets available_quantity_kg to the provided value (absolute)
 *     tags: [Admin Inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         description: Inventory record ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [transaction_type, quantity_kg]
 *             properties:
 *               transaction_type:
 *                 type: string
 *                 enum: [stock_in, stock_out, adjustment, return, wastage]
 *               quantity_kg:
 *                 type: number
 *                 description: Amount to add/subtract, or new absolute value for adjustment
 *               reference_type:
 *                 type: string
 *                 enum: [pickup, order, manual, return]
 *                 default: manual
 *               reference_id:
 *                 type: integer
 *                 description: ID of related pickup or order (optional)
 *               warehouse_location:
 *                 type: string
 *               minimum_stock_alert:
 *                 type: number
 *               remarks:
 *                 type: string
 *     responses:
 *       200:
 *         description: Inventory updated with transaction log created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 message: { type: string }
 *                 data:
 *                   type: object
 *                   properties:
 *                     inventory_id:         { type: integer }
 *                     previous_quantity_kg: { type: number }
 *                     new_quantity_kg:      { type: number }
 *                     transaction_type:     { type: string }
 *       400:
 *         description: Missing fields or insufficient stock
 *       404:
 *         description: Inventory record not found
 */
router.patch("/:id", ...admin, ctrl.updateInventory);

/**
 * @swagger
 * /admin/inventory/{id}/transactions:
 *   get:
 *     summary: Get transaction history for an inventory record
 *     description: Returns paginated transaction logs for a specific inventory item.
 *     tags: [Admin Inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *         description: Inventory record ID
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200:
 *         description: Paginated transaction history
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     transactions:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           transaction_id:    { type: integer }
 *                           transaction_type:  { type: string }
 *                           quantity_kg:       { type: number }
 *                           previous_quantity: { type: number }
 *                           new_quantity:      { type: number }
 *                           reference_type:    { type: string }
 *                           reference_id:      { type: integer }
 *                           remarks:           { type: string }
 *                           created_at:        { type: string, format: date-time }
 *                           performed_user:    { type: object }
 *                     pagination:
 *                       type: object
 *       404:
 *         description: Inventory record not found
 */
router.get("/:id/transactions", ...admin, ctrl.getInventoryTransactions);

module.exports = router;