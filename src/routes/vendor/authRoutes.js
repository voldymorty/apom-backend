const router = require("express").Router();
const ctrl = require("../../controllers/vendor/authController");
const { authenticate } = require("../../middleware/auth");

/**
 * @swagger
 * /vendor/auth/send-otp:
 *   post:
 *     summary: Step 1 — Send OTP
 *     tags: [Vendor Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [mobile_number]
 *             properties:
 *               mobile_number: { type: string, example: "9876543210" }
 *     responses:
 *       200:
 *         description: OTP sent successfully
 */
router.post("/send-otp", ctrl.sendOtp);

/**
 * @swagger
 * /vendor/auth/verify-otp:
 *   post:
 *     summary: Step 2 — Verify OTP and receive JWT token
 *     tags: [Vendor Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [mobile_number, otp_code]
 *             properties:
 *               mobile_number: { type: string, example: "9876543210" }
 *               otp_code:      { type: string, example: "4829" }
 *               fcm_token:     { type: string, description: "Optional Firebase push token" }
 *     responses:
 *       200:
 *         description: |
 *           JWT token returned.
 *           - profile_complete: false → redirect to setup-profile
 *           - profile_complete: true  → redirect to vendor home
 *       400:
 *         description: Invalid or expired OTP
 *       409:
 *         description: Number already registered under a different role
 */
router.post("/verify-otp", ctrl.verifyOtp);

/**
 * @swagger
 * /vendor/auth/setup-profile:
 *   post:
 *     summary: Step 3 — Complete vendor profile + save primary delivery address
 *     description: |
 *       Required vendor fields: business_name, owner_name, location_address, pincode, shop_photo
 *       Required address fields: address_line1, city, state
 *       Optional: business_type, gst_number, state_id, district_id, city_id,
 *                 latitude, longitude, profile_photo,
 *                 address_label (default "Main Shop"), address_line2, landmark,
 *                 contact_person, contact_number
 *     tags: [Vendor Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [business_name, owner_name, location_address, pincode, shop_photo, address_line1, city, state]
 *             properties:
 *               business_name:    { type: string, example: "Rajan Fresh Vegetables" }
 *               owner_name:       { type: string, example: "Rajan Kumar" }
 *               business_type:    { type: string, enum: [retail, restaurant, hotel, wholesale, other] }
 *               gst_number:       { type: string, example: "29ABCDE1234F1Z5" }
 *               location_address: { type: string, example: "12, MG Road, Coimbatore" }
 *               pincode:          { type: string, example: "641001" }
 *               state_id:         { type: integer, example: 1 }
 *               district_id:      { type: integer, example: 5 }
 *               city_id:          { type: integer, example: 12 }
 *               latitude:         { type: number, example: 11.0168 }
 *               longitude:        { type: number, example: 76.9558 }
 *               profile_photo:    { type: string, format: binary }
 *               shop_photo:       { type: string, format: binary }
 *               address_label:    { type: string, example: "Main Shop" }
 *               address_line1:    { type: string, example: "12, MG Road" }
 *               address_line2:    { type: string }
 *               landmark:         { type: string, example: "Near bus stand" }
 *               city:             { type: string, example: "Coimbatore" }
 *               state:            { type: string, example: "Tamil Nadu" }
 *               contact_person:   { type: string, example: "Rajan Kumar" }
 *               contact_number:   { type: string, example: "9876543210" }
 *     responses:
 *       201:
 *         description: Vendor profile and primary delivery address created
 *       400:
 *         description: Validation error or profile already set up
 *       409:
 *         description: Vendor profile already exists
 */
router.post("/setup-profile", authenticate, ctrl.uploadProfileImages, ctrl.setupProfile);

/**
 * @swagger
 * /vendor/auth/me:
 *   get:
 *     summary: Get current vendor profile with addresses
 *     tags: [Vendor Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Vendor user data with shop profile, addresses, and location info
 *       404:
 *         description: User not found
 */
router.get("/me", authenticate, ctrl.getMe);

/**
 * @swagger
 * /vendor/auth/edit-profile:
 *   put:
 *     summary: Edit vendor shop profile
 *     description: Updates only the fields you send. Also accepts email to update user email.
 *     tags: [Vendor Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               email:            { type: string, format: email }
 *               business_name:    { type: string }
 *               owner_name:       { type: string }
 *               business_type:    { type: string, enum: [retail, restaurant, hotel, wholesale, other] }
 *               gst_number:       { type: string }
 *               location_address: { type: string }
 *               pincode:          { type: string }
 *               state_id:         { type: integer }
 *               district_id:      { type: integer }
 *               city_id:          { type: integer }
 *               latitude:         { type: number }
 *               longitude:        { type: number }
 *               profile_photo:    { type: string, format: binary }
 *               shop_photo:       { type: string, format: binary }
 *     responses:
 *       200:
 *         description: Vendor profile updated successfully
 *       404:
 *         description: User or vendor profile not found
 */
router.put("/edit-profile", authenticate, ctrl.uploadProfileImages, ctrl.editProfile);

router.put("/fcm-token", authenticate, ctrl.updateFcmToken);

/**
 * @swagger
 * /vendor/auth/logout:
 *   post:
 *     summary: Logout — clears FCM token
 *     tags: [Vendor Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out successfully
 */
router.post("/logout", authenticate, ctrl.logout);

/**
 * @swagger
 * /vendor/auth/account:
 *   delete:
 *     summary: Deactivate vendor account (soft delete)
 *     tags: [Vendor Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Account deactivated successfully
 *       404:
 *         description: User not found
 */
router.delete("/account", authenticate, ctrl.deleteAccount);

module.exports = router;