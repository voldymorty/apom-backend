"use strict";

const router = require("express").Router();
const ctrl   = require("../../controllers/admin/CommissionController");
const { verifyAdminToken } = require("../../middleware/adminAuth");

// All commission routes are protected
router.use(verifyAdminToken);

// ════════════════════════════════════════════════════════════════════════════
//  COMMISSION SETTINGS
// ════════════════════════════════════════════════════════════════════════════

/**
 * @swagger
 * /admin/commission:
 *   get:
 *     summary: List all commission settings
 *     description: Returns all commission settings. Optionally filter by user_type or is_active.
 *     tags: [Admin Commission Settings]
 *     parameters:
 *       - in: query
 *         name: user_type
 *         schema:
 *           type: string
 *           enum: [farmer, vendor, delivery_personnel, platform]
 *           example: farmer
 *         description: Filter by user type
 *       - in: query
 *         name: is_active
 *         schema:
 *           type: boolean
 *           example: true
 *         description: Filter by active status
 *     responses:
 *       200:
 *         description: List of commission settings
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/CommissionSetting'
 *       400:
 *         description: Invalid filter value
 *       500:
 *         description: Internal server error
 */
router.get("/", ctrl.getAllCommissionSettings);

/**
 * @swagger
 * /admin/commission/{id}:
 *   get:
 *     summary: Get a single commission setting
 *     tags: [Admin Commission Settings]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *     responses:
 *       200:
 *         description: Commission setting detail
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   $ref: '#/components/schemas/CommissionSetting'
 *       404:
 *         description: Commission setting not found
 *       500:
 *         description: Internal server error
 */
router.get("/:id", ctrl.getCommissionSettingById);

/**
 * @swagger
 * /admin/commission:
 *   post:
 *     summary: Create a new commission setting
 *     tags: [Admin Commission Settings]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [user_type, commission_type, commission_value, effective_from]
 *             properties:
 *               user_type:
 *                 type: string
 *                 enum: [farmer, vendor, delivery_personnel, platform]
 *                 example: farmer
 *               commission_type:
 *                 type: string
 *                 enum: [percentage, fixed, tiered]
 *                 example: percentage
 *               commission_value:
 *                 type: number
 *                 example: 5.00
 *                 description: For percentage type, value must be between 0 and 100.
 *               minimum_transaction_amount:
 *                 type: number
 *                 example: 500.00
 *                 description: Minimum transaction amount for this commission to apply. Defaults to 0.
 *               maximum_commission_amount:
 *                 type: number
 *                 example: 2000.00
 *                 description: Cap on commission amount. Optional.
 *               effective_from:
 *                 type: string
 *                 format: date
 *                 example: "2025-04-01"
 *               effective_to:
 *                 type: string
 *                 format: date
 *                 example: "2025-12-31"
 *                 description: Optional end date. Must be after effective_from.
 *               description:
 *                 type: string
 *                 example: "5% commission on all farmer payouts from April 2025"
 *     responses:
 *       201:
 *         description: Commission setting created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Commission setting created successfully" }
 *                 data:
 *                   $ref: '#/components/schemas/CommissionSetting'
 *       400:
 *         description: Validation error (missing fields, invalid enum, bad date range)
 *       500:
 *         description: Internal server error
 */
router.post("/", ctrl.createCommissionSetting);

/**
 * @swagger
 * /admin/commission/{id}:
 *   put:
 *     summary: Update a commission setting
 *     description: All fields are optional — only send what needs to change.
 *     tags: [Admin Commission Settings]
 *     parameters:
 *       - in: path
 *         name: id
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
 *             properties:
 *               user_type:
 *                 type: string
 *                 enum: [farmer, vendor, delivery_personnel, platform]
 *                 example: vendor
 *               commission_type:
 *                 type: string
 *                 enum: [percentage, fixed, tiered]
 *                 example: fixed
 *               commission_value:
 *                 type: number
 *                 example: 50.00
 *               minimum_transaction_amount:
 *                 type: number
 *                 example: 1000.00
 *               maximum_commission_amount:
 *                 type: number
 *                 example: 5000.00
 *               is_active:
 *                 type: boolean
 *                 example: true
 *               effective_from:
 *                 type: string
 *                 format: date
 *                 example: "2025-04-01"
 *               effective_to:
 *                 type: string
 *                 format: date
 *                 example: "2025-12-31"
 *               description:
 *                 type: string
 *                 example: "Updated fixed commission for vendors"
 *     responses:
 *       200:
 *         description: Commission setting updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Commission setting updated successfully" }
 *                 data:
 *                   $ref: '#/components/schemas/CommissionSetting'
 *       400:
 *         description: Validation error
 *       404:
 *         description: Commission setting not found
 *       500:
 *         description: Internal server error
 */
router.put("/:id", ctrl.updateCommissionSetting);

/**
 * @swagger
 * /admin/commission/{id}:
 *   delete:
 *     summary: Deactivate a commission setting (soft delete)
 *     description: Sets is_active to false. Does not remove the record from the database.
 *     tags: [Admin Commission Settings]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *     responses:
 *       200:
 *         description: Commission setting deactivated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Commission setting deactivated successfully" }
 *       400:
 *         description: Already inactive
 *       404:
 *         description: Commission setting not found
 *       500:
 *         description: Internal server error
 */
router.delete("/:id", ctrl.deactivateCommissionSetting);

// ─── Shared Schema ───────────────────────────────────────────────────────────
/**
 * @swagger
 * components:
 *   schemas:
 *     CommissionSetting:
 *       type: object
 *       properties:
 *         setting_id:                  { type: integer, example: 1 }
 *         user_type:                   { type: string,  example: "farmer" }
 *         commission_type:             { type: string,  example: "percentage" }
 *         commission_value:            { type: number,  example: 5.00 }
 *         minimum_transaction_amount:  { type: number,  example: 500.00 }
 *         maximum_commission_amount:   { type: number,  example: 2000.00 }
 *         is_active:                   { type: boolean, example: true }
 *         effective_from:              { type: string,  example: "2025-04-01" }
 *         effective_to:                { type: string,  example: "2025-12-31" }
 *         description:                 { type: string,  example: "5% on farmer payouts" }
 *         created_by:                  { type: integer, example: 1 }
 *         created_at:                  { type: string,  example: "2025-04-01T10:00:00.000Z" }
 *         updated_at:                  { type: string,  example: "2025-04-01T10:00:00.000Z" }
 *         createdBy:
 *           type: object
 *           properties:
 *             user_id:       { type: integer, example: 1 }
 *             mobile_number: { type: string,  example: "9876543210" }
 *             role:          { type: string,  example: "admin" }
 */

module.exports = router;