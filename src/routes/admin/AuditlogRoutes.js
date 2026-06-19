"use strict";

const router = require("express").Router();
const ctrl   = require("../../controllers/admin/AuditLogController");
// const { verifyToken, isAdmin } = require("../../middlewares/authMiddleware");

// ════════════════════════════════════════════════════════════════════════════
//  AUDIT LOGS
// ════════════════════════════════════════════════════════════════════════════

/**
 * @swagger
 * /admin/audit-logs:
 *   get:
 *     summary: List audit logs
 *     description: >
 *       Returns a paginated list of audit logs. Supports filtering by user,
 *       action type, action, table name, and date range.
 *       action_type supports partial match (e.g. "order" matches "order.created").
 *     tags: [Admin Audit Logs]
 *     parameters:
 *       - in: query
 *         name: user_id
 *         schema:
 *           type: integer
 *           example: 5
 *         description: Filter logs by the user who performed the action
 *       - in: query
 *         name: action_type
 *         schema:
 *           type: string
 *           example: "order"
 *         description: Partial match on action_type (e.g. "order", "inventory", "user.login")
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *           enum: [create, read, update, delete]
 *           example: update
 *         description: Exact CRUD action performed
 *       - in: query
 *         name: table_name
 *         schema:
 *           type: string
 *           example: "orders"
 *         description: Filter by the database table affected
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date
 *           example: "2025-03-01"
 *         description: Start date filter (YYYY-MM-DD)
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date
 *           example: "2025-03-31"
 *         description: End date filter (YYYY-MM-DD)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           example: 1
 *         description: Page number (default 1)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           example: 20
 *         description: Records per page (max 100, default 20)
 *     responses:
 *       200:
 *         description: Paginated list of audit logs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     logs:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/AuditLog'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         total:       { type: integer, example: 540 }
 *                         page:        { type: integer, example: 1   }
 *                         limit:       { type: integer, example: 20  }
 *                         total_pages: { type: integer, example: 27  }
 *       400:
 *         description: Invalid filter value (e.g. bad action, non-integer user_id)
 *       500:
 *         description: Internal server error
 */
router.get("/", ctrl.getAuditLogs);

/**
 * @swagger
 * /admin/audit-logs/{id}:
 *   get:
 *     summary: Get a single audit log entry
 *     description: >
 *       Returns the full detail of one audit log, including old_values and
 *       new_values JSON diffs and device info.
 *     tags: [Admin Audit Logs]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 128
 *     responses:
 *       200:
 *         description: Audit log detail
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   $ref: '#/components/schemas/AuditLog'
 *       404:
 *         description: Audit log not found
 *       500:
 *         description: Internal server error
 */
router.get("/:id", ctrl.getAuditLogById);

// ─── Shared Schema ───────────────────────────────────────────────────────────
/**
 * @swagger
 * components:
 *   schemas:
 *     AuditLog:
 *       type: object
 *       properties:
 *         log_id:       { type: integer, example: 128 }
 *         user_id:      { type: integer, example: 5   }
 *         action_type:  { type: string,  example: "order.updated" }
 *         table_name:   { type: string,  example: "orders"        }
 *         record_id:    { type: integer, example: 42              }
 *         action:       { type: string,  example: "update"        }
 *         old_values:
 *           type: object
 *           example: { order_status: "placed", payment_status: "pending" }
 *         new_values:
 *           type: object
 *           example: { order_status: "confirmed", payment_status: "paid" }
 *         ip_address:   { type: string, example: "192.168.1.10"   }
 *         user_agent:   { type: string, example: "Mozilla/5.0..." }
 *         device_info:
 *           type: object
 *           example: { platform: "android", app_version: "1.2.0" }
 *         created_at:   { type: string, example: "2025-03-15T08:45:00.000Z" }
 *         user:
 *           type: object
 *           properties:
 *             user_id:       { type: integer, example: 5              }
 *             mobile_number: { type: string,  example: "9876543210"   }
 *             role:          { type: string,  example: "admin"        }
 */

module.exports = router;