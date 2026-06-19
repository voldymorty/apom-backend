const router = require("express").Router();

const {
  createFirstAdmin,
  createAdmin,
  login,
  getMe,
  getAllAdmins,
  getAdminById,
  softDeleteAdmin,
  hardDeleteAdmin,
  restoreAdmin,
} = require("../../controllers/admin/authController");

const { verifyAdminToken } = require("../../middleware/adminAuth");

// ─── Public Routes ────────────────────────────────────────────────────────────

/**
 * @swagger
 * /admin/auth/create-first-admin:
 *   post:
 *     summary: Create the first admin account (one-time setup)
 *     description: >
 *       Creates the very first admin. Automatically blocked once any admin exists.
 *       Lock this endpoint down via firewall or env flag after first use.
 *     tags: [Admin Auth]
 *     security: []
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
 *                 example: "9999999999"
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 example: "Admin@1234"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "admin@apom.in"
 *     responses:
 *       201:
 *         description: Admin created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Admin account created successfully" }
 *                 data:
 *                   type: object
 *                   properties:
 *                     token: { type: string, example: "eyJhbGci..." }
 *                     admin:
 *                       type: object
 *                       properties:
 *                         user_id:       { type: string, example: "uuid-here" }
 *                         mobile_number: { type: string, example: "9999999999" }
 *                         email:         { type: string, example: "admin@apom.in" }
 *                         role:          { type: string, example: "admin" }
 *                         created_at:    { type: string, format: date-time }
 *       400:
 *         description: Missing required fields or weak password
 *       409:
 *         description: Admin already exists or mobile already registered
 *       500:
 *         description: Internal server error
 */
router.post("/create-first-admin", createFirstAdmin);

/**
 * @swagger
 * /admin/auth/login:
 *   post:
 *     summary: Admin login
 *     description: Authenticates an admin and returns a 2-hour JWT access token.
 *     tags: [Admin Auth]
 *     security: []
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
 *                 example: "9688844421"
 *               password:
 *                 type: string
 *                 example: "sudha007"
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Login successful" }
 *                 data:
 *                   type: object
 *                   properties:
 *                     token:      { type: string, example: "eyJhbGci..." }
 *                     expires_in: { type: string, example: "2h" }
 *                     admin:
 *                       type: object
 *                       properties:
 *                         user_id:       { type: string, example: "uuid-here" }
 *                         mobile_number: { type: string, example: "9688844421" }
 *                         email:         { type: string, example: "admin@apom.in" }
 *                         role:          { type: string, example: "admin" }
 *                         last_login:    { type: string, format: date-time }
 *       400:
 *         description: Missing required fields
 *       401:
 *         description: Invalid credentials
 *       403:
 *         description: Account is deactivated
 *       500:
 *         description: Internal server error
 */
router.post("/login", login);

// ─── Protected Routes ─────────────────────────────────────────────────────────

/**
 * @swagger
 * /admin/auth/create-admin:
 *   post:
 *     summary: Create a new admin account
 *     description: >
 *       Creates a new admin account. Requires an authenticated admin.
 *       Unlike create-first-admin, this can be called multiple times
 *       to provision additional admins.
 *     tags: [Admin Auth]
 *     security:
 *       - bearerAuth: []
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
 *                 minLength: 8
 *                 example: "Admin@1234"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "newadmin@apom.in"
 *     responses:
 *       201:
 *         description: Admin created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Admin account created successfully" }
 *                 data:
 *                   type: object
 *                   properties:
 *                     admin:
 *                       type: object
 *                       properties:
 *                         user_id:       { type: integer, example: 2 }
 *                         mobile_number: { type: string, example: "9876543210" }
 *                         email:         { type: string, example: "newadmin@apom.in" }
 *                         role:          { type: string, example: "admin" }
 *                         created_at:    { type: string, format: date-time }
 *       400:
 *         description: Missing required fields or weak password
 *       401:
 *         description: Token missing, invalid, or expired
 *       403:
 *         description: Access denied — admins only
 *       409:
 *         description: Mobile number already registered
 *       500:
 *         description: Internal server error
 */
router.post("/create-admin", verifyAdminToken, createAdmin);


/**
 * @swagger
 * /admin/auth/me:
 *   get:
 *     summary: Get current admin profile
 *     description: Returns the profile of the currently authenticated admin.
 *     tags: [Admin Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Admin profile fetched
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Admin profile fetched" }
 *                 data:
 *                   type: object
 *                   properties:
 *                     user_id:          { type: string, example: "uuid-here" }
 *                     mobile_number:    { type: string, example: "9999999999" }
 *                     email:            { type: string, example: "admin@apom.in" }
 *                     role:             { type: string, example: "admin" }
 *                     is_active:        { type: integer, example: 1 }
 *                     is_verified:      { type: integer, example: 1 }
 *                     profile_complete: { type: integer, example: 1 }
 *                     created_at:       { type: string, format: date-time }
 *                     last_login:       { type: string, format: date-time }
 *       401:
 *         description: Token missing, invalid, or expired
 *       403:
 *         description: Access denied — admins only
 *       404:
 *         description: Admin not found
 *       500:
 *         description: Internal server error
 */
router.get("/me", verifyAdminToken, getMe);

/**
 * @swagger
 * /admin/auth/list:
 *   get:
 *     summary: List all admin accounts
 *     description: Returns all admin user records. Useful for multi-admin management.
 *     tags: [Admin Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Admins fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Admins fetched" }
 *                 data:
 *                   type: object
 *                   properties:
 *                     count: { type: integer, example: 2 }
 *                     admins:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           user_id:       { type: string, example: "uuid-here" }
 *                           mobile_number: { type: string, example: "9999999999" }
 *                           email:         { type: string, example: "admin@apom.in" }
 *                           is_active:     { type: integer, example: 1 }
 *                           is_verified:   { type: integer, example: 1 }
 *                           created_at:    { type: string, format: date-time }
 *                           last_login:    { type: string, format: date-time }
 *       401:
 *         description: Token missing, invalid, or expired
 *       403:
 *         description: Access denied — admins only
 *       500:
 *         description: Internal server error
 */
router.get("/list", verifyAdminToken, getAllAdmins);

/**
 * @swagger
 * /admin/auth/{user_id}:
 *   get:
 *     summary: Get a specific admin by user_id
 *     tags: [Admin Auth]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: user_id
 *         required: true
 *         schema:
 *           type: string
 *           example: "uuid-here"
 *         description: UUID of the admin user
 *     responses:
 *       200:
 *         description: Admin fetched successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Admin fetched" }
 *                 data:
 *                   type: object
 *                   properties:
 *                     user_id:          { type: string, example: "uuid-here" }
 *                     mobile_number:    { type: string, example: "9999999999" }
 *                     email:            { type: string, example: "admin@apom.in" }
 *                     is_active:        { type: integer, example: 1 }
 *                     is_verified:      { type: integer, example: 1 }
 *                     profile_complete: { type: integer, example: 1 }
 *                     created_at:       { type: string, format: date-time }
 *                     last_login:       { type: string, format: date-time }
 *       401:
 *         description: Token missing, invalid, or expired
 *       403:
 *         description: Access denied — admins only
 *       404:
 *         description: Admin not found
 *       500:
 *         description: Internal server error
 */
router.get("/:user_id", verifyAdminToken, getAdminById);

/**
 * @swagger
 * /admin/auth/{user_id}/soft:
 *   delete:
 *     summary: Soft delete (deactivate) an admin
 *     description: >
 *       Sets is_active to 0. The admin can no longer log in but the record is retained.
 *       Cannot deactivate your own account.
 *     tags: [Admin Auth]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: user_id
 *         required: true
 *         schema:
 *           type: string
 *           example: "uuid-here"
 *         description: UUID of the admin to deactivate
 *     responses:
 *       200:
 *         description: Admin deactivated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Admin account deactivated successfully" }
 *                 data:
 *                   type: object
 *                   properties:
 *                     user_id:       { type: string, example: "uuid-here" }
 *                     mobile_number: { type: string, example: "9999999999" }
 *                     is_active:     { type: integer, example: 0 }
 *       400:
 *         description: Cannot deactivate your own account
 *       401:
 *         description: Token missing, invalid, or expired
 *       403:
 *         description: Access denied — admins only
 *       404:
 *         description: Admin not found
 *       409:
 *         description: Admin is already deactivated
 *       500:
 *         description: Internal server error
 */
router.delete("/:user_id/soft", verifyAdminToken, softDeleteAdmin);

/**
 * @swagger
 * /admin/auth/{user_id}/hard:
 *   delete:
 *     summary: Hard delete an admin (permanent)
 *     description: >
 *       Permanently removes the admin user record from the database.
 *       This action is irreversible. Cannot delete your own account.
 *     tags: [Admin Auth]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: user_id
 *         required: true
 *         schema:
 *           type: string
 *           example: "uuid-here"
 *         description: UUID of the admin to permanently delete
 *     responses:
 *       200:
 *         description: Admin permanently deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Admin account permanently deleted" }
 *                 data:
 *                   type: object
 *                   properties:
 *                     user_id: { type: string, example: "uuid-here" }
 *       400:
 *         description: Cannot delete your own account
 *       401:
 *         description: Token missing, invalid, or expired
 *       403:
 *         description: Access denied — admins only
 *       404:
 *         description: Admin not found
 *       500:
 *         description: Internal server error
 */
router.delete("/:user_id/hard", verifyAdminToken, hardDeleteAdmin);

/**
 * @swagger
 * /admin/auth/{user_id}/restore:
 *   patch:
 *     summary: Restore a deactivated admin account
 *     description: Sets is_active back to 1 for a previously soft-deleted admin.
 *     tags: [Admin Auth]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: user_id
 *         required: true
 *         schema:
 *           type: string
 *           example: "uuid-here"
 *         description: UUID of the admin to restore
 *     responses:
 *       200:
 *         description: Admin restored successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "Admin account restored successfully" }
 *                 data:
 *                   type: object
 *                   properties:
 *                     user_id:       { type: string, example: "uuid-here" }
 *                     mobile_number: { type: string, example: "9999999999" }
 *                     is_active:     { type: integer, example: 1 }
 *       401:
 *         description: Token missing, invalid, or expired
 *       403:
 *         description: Access denied — admins only
 *       404:
 *         description: Admin not found
 *       409:
 *         description: Admin is already active
 *       500:
 *         description: Internal server error
 */
router.patch("/:user_id/restore", verifyAdminToken, restoreAdmin);

module.exports = router;