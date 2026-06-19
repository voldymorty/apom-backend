const router = require("express").Router();
const ctrl = require("../../controllers/delivery/authController");
const { authenticate, authorizeRoles } = require("../../middleware/auth");

/**
 * @swagger
 * tags:
 *   name: Delivery Auth
 *   description: Authentication for delivery personnel (mobile + password)
 */

/**
 * @swagger
 * /delivery/auth/login:
 *   post:
 *     summary: Login with mobile number and password
 *     tags: [Delivery Auth]
 *     description: |
 *       Account is pre-created by admin. Delivery person enters their mobile number
 *       and the password provided by admin to log in.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [mobile_number, password]
 *             properties:
 *               mobile_number:
 *                 type: string
 *                 example: "9876543210"
 *               password:
 *                 type: string
 *                 example: "delivery@123"
 *     responses:
 *       200:
 *         description: Login successful — returns JWT token and delivery profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:          { type: boolean }
 *                 token:            { type: string }
 *                 user:             { type: object }
 *                 delivery_profile: { type: object }
 *       401:
 *         description: Invalid mobile number or password
 *       403:
 *         description: Account deactivated — contact admin
 */
router.post("/login", ctrl.login);

/**
 * @swagger
 * /delivery/auth/logout:
 *   post:
 *     summary: Logout (client discards JWT)
 *     tags: [Delivery Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out successfully
 */
router.put("/fcm-token", authenticate, ctrl.updateFcmToken);

router.post("/logout", authenticate, ctrl.logout);

/**
 * @swagger
 * /delivery/auth/change-password:
 *   put:
 *     summary: Change own password (while logged in)
 *     tags: [Delivery Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [current_password, new_password]
 *             properties:
 *               current_password: { type: string, example: "oldPass123" }
 *               new_password:     { type: string, example: "newPass456", minLength: 6 }
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       400:
 *         description: Current password incorrect or new password too short
 */
router.put(
  "/change-password",
  authenticate,
  authorizeRoles("delivery"),
  ctrl.changePassword
);

/**
 * @swagger
 * /delivery/auth/create:
 *   post:
 *     summary: Create a new delivery person account (admin only)
 *     tags: [Delivery Auth]
 *     description: |
 *       Admin creates the delivery person's account with an initial password.
 *       The delivery person uses their mobile number + this password to log in.
 *       For forgot password, delivery person contacts admin → admin calls `reset-password`.
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [mobile_number, password, full_name, vehicle_type, vehicle_number]
 *             properties:
 *               mobile_number:       { type: string, example: "9876543210" }
 *               password:            { type: string, example: "deliver@123", minLength: 6 }
 *               full_name:           { type: string, example: "Alex Rivera" }
 *               vehicle_type:        { type: string, enum: [bike, auto, tempo, truck, van] }
 *               vehicle_number:      { type: string, example: "TN01AB1234" }
 *               license_number:      { type: string }
 *               license_expiry_date: { type: string, format: date }
 *               profile_photo:       { type: string, format: binary }
 *     responses:
 *       201:
 *         description: Delivery account created successfully
 *       409:
 *         description: Mobile number already registered
 */
router.post(
  "/create",
  // authenticate,
  // authorizeRoles("admin"),
  ctrl.uploadProfilePhoto,
  ctrl.createDeliveryAccount
);

/**
 * @swagger
 * /delivery/auth/reset-password:
 *   put:
 *     summary: Reset a delivery person's password (admin only)
 *     tags: [Delivery Auth]
 *     description: |
 *       Backend for the **Forgot Password** flow.
 *       When a delivery person forgets their password, they contact admin (via the
 *       "Contact Admin" button in the app). Admin then resets the password here.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [mobile_number, new_password]
 *             properties:
 *               mobile_number: { type: string, example: "9876543210" }
 *               new_password:  { type: string, example: "newPass123", minLength: 6 }
 *     responses:
 *       200:
 *         description: Password reset successfully
 *       404:
 *         description: Delivery person not found
 */
router.put(
  "/reset-password",
  authenticate,
  authorizeRoles("admin"),
  ctrl.resetPassword
);

module.exports = router;