"use strict";

const router = require("express").Router();
const ctrl   = require("../../controllers/admin/PayoutController");
const { verifyAdminToken } = require("../../middleware/adminAuth");

router.use(verifyAdminToken);

// ════════════════════════════════════════════════════════════════════════════
//  Admin Farmer Payouts
// ════════════════════════════════════════════════════════════════════════════

/**
 * @swagger
 * /admin/payouts:
 *   get:
 *     summary: List all farmer payout records
 *     description: >
 *       Returns paginated farmer earnings / payout records.
 *       Supports filtering by farmer, payment status, payment method, and date range.
 *     tags: [Admin Farmer Payouts]
 *     parameters:
 *       - in: query
 *         name: farmer_id
 *         schema:
 *           type: integer
 *           example: 12
 *         description: Filter by farmer
 *       - in: query
 *         name: payment_status
 *         schema:
 *           type: string
 *           enum: [pending, processing, paid, failed]
 *           example: pending
 *       - in: query
 *         name: payment_method
 *         schema:
 *           type: string
 *           enum: [bank_transfer, upi, cash, cheque]
 *           example: bank_transfer
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date
 *           example: "2025-03-01"
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date
 *           example: "2025-03-31"
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
 *     responses:
 *       200:
 *         description: Paginated list of payout records
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     payouts:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Payout'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         total:       { type: integer, example: 84 }
 *                         page:        { type: integer, example: 1  }
 *                         limit:       { type: integer, example: 20 }
 *                         total_pages: { type: integer, example: 5  }
 *       400:
 *         description: Invalid filter value
 *       500:
 *         description: Internal server error
 */
router.get("/", ctrl.getAllPayouts);

/**
 * @swagger
 * /admin/payouts/{id}:
 *   get:
 *     summary: Get a single payout record
 *     description: Returns full payout detail including farmer, crop, product, and pickup delivery info.
 *     tags: [Admin Farmer Payouts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 7
 *     responses:
 *       200:
 *         description: Payout detail
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   $ref: '#/components/schemas/Payout'
 *       404:
 *         description: Payout record not found
 *       500:
 *         description: Internal server error
 */
router.get("/:id", ctrl.getPayoutById);

/**
 * @swagger
 * /admin/payouts:
 *   post:
 *     summary: Manually create a payout record
 *     description: >
 *       Creates a new farmer earning entry manually.
 *       commission_amount and net_amount are computed automatically from
 *       quantity_supplied_kg × price_per_kg and commission_percentage.
 *     tags: [Admin Farmer Payouts]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [farmer_id, quantity_supplied_kg, price_per_kg]
 *             properties:
 *               farmer_id:
 *                 type: integer
 *                 example: 12
 *               crop_id:
 *                 type: integer
 *                 example: 5
 *                 description: Optional. Links to farmer_crops.
 *               pickup_delivery_id:
 *                 type: integer
 *                 example: 33
 *                 description: Optional. Links to pickup_deliveries.
 *               quantity_supplied_kg:
 *                 type: number
 *                 example: 200.00
 *               price_per_kg:
 *                 type: number
 *                 example: 60.00
 *               commission_percentage:
 *                 type: number
 *                 example: 5.00
 *                 description: Defaults to 0 if not provided.
 *               payment_method:
 *                 type: string
 *                 enum: [bank_transfer, upi, cash, cheque]
 *                 example: bank_transfer
 *               remarks:
 *                 type: string
 *                 example: "Manual entry for offline pickup"
 *     responses:
 *       201:
 *         description: Payout record created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Payout record created successfully" }
 *                 data:
 *                   $ref: '#/components/schemas/Payout'
 *       400:
 *         description: Validation error
 *       404:
 *         description: Farmer not found
 *       500:
 *         description: Internal server error
 */
router.post("/", ctrl.createPayout);

/**
 * @swagger
 * /admin/payouts/{id}/status:
 *   put:
 *     summary: Update payout payment status
 *     description: >
 *       Updates the payment status of a payout record.
 *       Automatically stamps payment_date when status is set to 'paid'.
 *       Cannot revert a paid payout back to pending.
 *     tags: [Admin Farmer Payouts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 7
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [payment_status]
 *             properties:
 *               payment_status:
 *                 type: string
 *                 enum: [pending, processing, paid, failed]
 *                 example: paid
 *               payment_method:
 *                 type: string
 *                 enum: [bank_transfer, upi, cash, cheque]
 *                 example: bank_transfer
 *               transaction_reference:
 *                 type: string
 *                 example: "TXN20250401001"
 *               transaction_id:
 *                 type: string
 *                 example: "NEFT123456789"
 *               remarks:
 *                 type: string
 *                 example: "Transferred via NEFT"
 *     responses:
 *       200:
 *         description: Payout status updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Payout status updated to 'paid' successfully" }
 *                 data:
 *                   $ref: '#/components/schemas/Payout'
 *       400:
 *         description: Validation error or invalid status transition
 *       404:
 *         description: Payout record not found
 *       500:
 *         description: Internal server error
 */
router.put("/:id/status", ctrl.updatePayoutStatus);

// ─── Shared Schema ────────────────────────────────────────────────────────────
/**
 * @swagger
 * components:
 *   schemas:
 *     Payout:
 *       type: object
 *       properties:
 *         earning_id:              { type: integer, example: 7              }
 *         farmer_id:               { type: integer, example: 12             }
 *         crop_id:                 { type: integer, example: 5              }
 *         pickup_delivery_id:      { type: integer, example: 33             }
 *         quantity_supplied_kg:    { type: number,  example: 200.00         }
 *         price_per_kg:            { type: number,  example: 60.00          }
 *         total_amount:            { type: number,  example: 12000.00       }
 *         commission_percentage:   { type: number,  example: 5.00           }
 *         commission_amount:       { type: number,  example: 600.00         }
 *         net_amount:              { type: number,  example: 11400.00       }
 *         payment_status:          { type: string,  example: "paid"         }
 *         payment_date:            { type: string,  example: "2025-04-01T10:00:00.000Z" }
 *         payment_method:          { type: string,  example: "bank_transfer"}
 *         transaction_reference:   { type: string,  example: "TXN001"       }
 *         transaction_id:          { type: string,  example: "NEFT123"      }
 *         remarks:                 { type: string,  example: "On time"      }
 *         created_at:              { type: string,  example: "2025-04-01T08:00:00.000Z" }
 *         updated_at:              { type: string,  example: "2025-04-01T10:00:00.000Z" }
 *         farmer:
 *           type: object
 *           properties:
 *             farmer_id:  { type: integer, example: 12            }
 *             full_name:  { type: string,  example: "Ravi Kumar"  }
 *             farm_name:  { type: string,  example: "Ravi Farms"  }
 *             user:
 *               type: object
 *               properties:
 *                 user_id:       { type: integer, example: 20           }
 *                 mobile_number: { type: string,  example: "9876543210" }
 *         crop:
 *           type: object
 *           properties:
 *             crop_id:       { type: integer, example: 5        }
 *             grade:         { type: string,  example: "A"      }
 *             quantity_kg:   { type: number,  example: 200.00   }
 *             harvest_date:  { type: string,  example: "2025-03-20" }
 *             product:
 *               type: object
 *               properties:
 *                 product_id:   { type: integer, example: 3         }
 *                 product_name: { type: string,  example: "Tomato"  }
 *                 product_code: { type: string,  example: "VEG-TOM" }
 *                 unit:         { type: string,  example: "kg"      }
 *         pickupDelivery:
 *           type: object
 *           properties:
 *             delivery_id:     { type: integer, example: 33              }
 *             delivery_number: { type: string,  example: "DEL-2025-0033" }
 *             status:          { type: string,  example: "completed"     }
 *             scheduled_date:  { type: string,  example: "2025-03-20"    }
 *             completed_at:    { type: string,  example: "2025-03-20T14:00:00.000Z" }
 */

module.exports = router;