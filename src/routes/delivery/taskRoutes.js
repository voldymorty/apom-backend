const router = require("express").Router();
const ctrl   = require("../../controllers/delivery/taskController");
const { authenticate, authorizeRoles } = require("../../middleware/auth");

const guard = [authenticate, authorizeRoles("delivery")];

/**
 * @swagger
 * tags:
 *   name: Delivery Tasks
 *   description: |
 *     Task list, details, status updates, OTP verification, and proof photos.
 *     Covers BOTH pickup tasks (driver collects from farmer) and delivery tasks
 *     (driver drops off at vendor / hub). The `delivery_type` field on each task
 *     distinguishes them — `pickup` maps to the PICKUPS tab and `delivery` maps
 *     to the DROPS tab in the Flutter app.
 */

/**
 * @swagger
 * /delivery/tasks:
 *   get:
 *     summary: Get all tasks for the logged-in driver (TaskScreen)
 *     tags: [Delivery Tasks]
 *     description: |
 *       Use the `type` filter to power the PICKUPS / DROPS tabs:
 *       - `type=pickup`   → PICKUPS tab
 *       - `type=delivery` → DROPS tab
 *       - No type filter  → all tasks
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [pickup, delivery] }
 *         description: Filter by task type
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [assigned, accepted, in_transit, reached, completed, failed, cancelled]
 *       - in: query
 *         name: date
 *         schema: { type: string, format: date, example: "2025-06-10" }
 *         description: Filter by scheduled date (defaults to all dates)
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Paginated task list with farmer/vendor, crop, and order info
 */
router.get("/", ...guard, ctrl.getTasks);

/**
 * @swagger
 * /delivery/tasks/{delivery_id}:
 *   get:
 *     summary: Full details of a single task (PickupDetailsScreen / DeliveryDetailsScreen)
 *     tags: [Delivery Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: delivery_id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Full task with farmer/vendor, cargo, order, and status history
 *       404:
 *         description: Task not found
 */
router.get("/:delivery_id", ...guard, ctrl.getTaskById);

/**
 * @swagger
 * /delivery/tasks/{delivery_id}/status:
 *   patch:
 *     summary: Update task status (works for both pickup and delivery tasks)
 *     tags: [Delivery Tasks]
 *     description: |
 *       **Status flow:**
 *       `assigned` → `accepted` → `in_transit` → `reached` → `completed` / `failed`
 *
 *       - Setting `accepted` increments `total_deliveries` and marks driver unavailable.
 *       - Setting `completed` requires OTP to be verified first via `PATCH /:id/verify-otp`.
 *       - Setting `failed` or `cancelled` frees up the driver.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: delivery_id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [accepted, in_transit, reached, completed, failed, cancelled]
 *               actual_quantity_kg:
 *                 type: number
 *                 description: Provide when status = completed
 *               delivery_notes:
 *                 type: string
 *               failure_reason:
 *                 type: string
 *                 description: Provide when status = failed
 *     responses:
 *       200:
 *         description: Status updated successfully
 *       400:
 *         description: OTP not verified or invalid status
 *       404:
 *         description: Task not found
 */
router.patch("/:delivery_id/status", ...guard, ctrl.updateTaskStatus);

/**
 * @swagger
 * /delivery/tasks/{delivery_id}/proof-photo:
 *   post:
 *     summary: Upload proof photo and receive OTP for handover confirmation
 *     tags: [Delivery Tasks]
 *     description: |
 *       **Pickup task:** Upload a loading photo → OTP is generated → driver shows OTP
 *       to the farmer → farmer reads it back → driver enters it in `verify-otp`.
 *
 *       **Delivery task:** Upload a delivery photo → OTP is generated → driver shows
 *       OTP to the vendor/hub → they read it back → driver enters it in `verify-otp`.
 *
 *       On success, a **4-digit OTP** is returned in `otp_code`. The driver must share
 *       this with the farmer or recipient. Once they confirm by providing it back, the
 *       driver calls `PATCH /:id/verify-otp` to complete the task.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: delivery_id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [proof_photo]
 *             properties:
 *               proof_photo:
 *                 type: string
 *                 format: binary
 *                 description: Max 10 MB. JPEG, PNG, WebP.
 *               latitude:
 *                 type: number
 *                 format: float
 *                 example: 10.8505
 *                 description: Current GPS latitude of the driver
 *               longitude:
 *                 type: number
 *                 format: float
 *                 example: 76.2711
 *                 description: Current GPS longitude of the driver
 *     responses:
 *       200:
 *         description: Photo uploaded and OTP generated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:         { type: boolean }
 *                 message:         { type: string }
 *                 proof_photo_url: { type: string }
 *                 otp_code:        { type: string, example: "4821", description: "Show to farmer/vendor" }
 *                 delivery_type:   { type: string, enum: [pickup, delivery] }
 *       400:
 *         description: No file provided
 *       404:
 *         description: Task not found
 */
router.post(
  "/:delivery_id/proof-photo",
  ...guard,
  ctrl.uploadProofPhoto, // multer middleware
  ctrl.uploadProof
);

/**
 * @swagger
 * /delivery/tasks/{delivery_id}/verify-otp:
 *   patch:
 *     summary: Verify handover OTP and auto-complete the task
 *     tags: [Delivery Tasks]
 *     description: |
 *       **Pickup:** Farmer provides the OTP shown on their screen → driver enters it here.
 *       **Delivery:** Vendor/hub manager provides the OTP → driver enters it here.
 *
 *       On success, task status is set to `completed`, `completed_deliveries` is
 *       incremented, and the driver is marked available again.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: delivery_id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [otp_code]
 *             properties:
 *               otp_code:
 *                 type: string
 *                 example: "4821"
 *               actual_quantity_kg:
 *                 type: number
 *                 description: Required for pickup — actual kg procured at farmer
 *               procurement_amount:
 *                 type: number
 *                 description: Required for pickup — total amount agreed at farmer (INR)
 *     responses:
 *       200:
 *         description: OTP verified — task completed
 *       400:
 *         description: Invalid OTP
 *       404:
 *         description: Task not found
 */
router.patch("/:delivery_id/verify-otp", ...guard, ctrl.verifyTaskOtp);

module.exports = router;