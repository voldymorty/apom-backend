const router = require("express").Router();
const ctrl = require("../../controllers/farmer/authController");
const { authenticate } = require("../../middleware/auth");

/**
 * @swagger
 * /auth/send-otp:
 *   post:
 *     summary: Step 1 — Send OTP to mobile number
 *     tags: [Farmer Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [mobile_number, role]
 *             properties:
 *               mobile_number: { type: string, example: "9876543210" }
 *               role:          { type: string, enum: [farmer, vendor, delivery], example: "farmer" }
 *     responses:
 *       200:
 *         description: OTP sent successfully
 */
router.post("/send-otp", ctrl.sendOtp);

/**
 * @swagger
 * /auth/verify-otp:
 *   post:
 *     summary: Step 2 — Verify OTP and receive JWT token
 *     tags: [Farmer Auth]
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
 *           - `profile_complete: false` → redirect to setup-profile
 *           - `profile_complete: true`  → redirect to home
 *       400:
 *         description: Invalid or expired OTP
 */
router.post("/verify-otp", ctrl.verifyOtp);

/**
 * @swagger
 * /auth/setup-profile:
 *   post:
 *     summary: Step 3 — Complete profile setup after first login
 *     description: |
 *       Called once when `profile_complete` is `false`. Role is read from JWT.
 *
 *       **Farmer:** full_name*, location_address*, total_land*, land_unit*, land_segments*, state_id*, district_id*, city_id*, aadhar_number, farm_name, pincode, latitude, longitude, profile_photo, land_photo
 *
 *       **Vendor:** business_name*, owner_name, business_type, gst_number, fssai_number
 *
 *       **Delivery:** full_name*, vehicle_type*, vehicle_number*, license_number, license_expiry_date, profile_photo
 *     tags: [Farmer Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               full_name:        { type: string }
 *               aadhar_number:    { type: string }
 *               farm_name:        { type: string }
 *               location_address: { type: string }
 *               pincode:          { type: string }
 *               state_id:         { type: integer }
 *               district_id:      { type: integer }
 *               city_id:          { type: integer }
 *               latitude:         { type: number }
 *               longitude:        { type: number }
 *               total_land:       { type: number }
 *               land_unit:        { type: string, enum: [acres, hectares, cent] }
 *               land_segments:    [{"crop_name":"Paddy","area_value":2.5,"plantation_date":"2025-01-01","harvesting_date":"2025-06-01"},{"crop_name":"Tomato","area_value":0.7,"plantation_date":"2025-02-01","harvesting_date":"2025-05-01"}]
 *               profile_photo:    { type: string, format: binary }
 *               land_photo:       { type: string, format: binary }
 *     responses:
 *       201:
 *         description: Profile setup completed
 *       400:
 *         description: Profile already set up or validation error
 *       409:
 *         description: Profile record already exists
 */
router.post("/setup-profile", authenticate, ctrl.uploadProfileImages, ctrl.setupProfile);

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Get current logged-in user with full profile
 *     tags: [Farmer Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User data with role-specific profile (farmer includes land_segments, state, district, city)
 *       404:
 *         description: User not found
 */
router.get("/me", authenticate, ctrl.getMe);

/**
 * @swagger
 * /auth/edit-profile:
 *   put:
 *     summary: Edit role-specific profile details and photos
 *     description: |
 *       Updates only the fields you send. Role is read from JWT.
 *
 *       **Farmer:** full_name, farm_name, location_address, pincode, state_id, district_id, city_id, latitude, longitude, total_land, land_unit, profile_photo, land_photo
 *
 *       **Vendor:** business_name, owner_name, business_type, gst_number, fssai_number
 *
 *       **Delivery:** full_name, vehicle_type, vehicle_number, license_number, license_expiry_date, profile_photo
 *
 *       Also accepts `email` for all roles to update user email.
 *     tags: [Farmer Auth]
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
 *               full_name:        { type: string }
 *               farm_name:        { type: string }
 *               location_address: { type: string }
 *               pincode:          { type: string }
 *               state_id:         { type: integer }
 *               district_id:      { type: integer }
 *               city_id:          { type: integer }
 *               latitude:         { type: number }
 *               longitude:        { type: number }
 *               total_land:       { type: number }
 *               land_unit:        { type: string, enum: [acres, hectares, cent] }
 *               profile_photo:    { type: string, format: binary }
 *               land_photo:       { type: string, format: binary }
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       404:
 *         description: User or profile not found
 */
router.put("/edit-profile", authenticate, ctrl.uploadProfileImages, ctrl.editProfile);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Logout — clears FCM token
 *     description: |
 *       JWT tokens are stateless and cannot be invalidated server-side.
 *       This endpoint clears the FCM token so the user stops receiving push notifications.
 *       The client must delete the JWT token from local storage.
 *     tags: [Farmer Auth]
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
 * /auth/account:
 *   delete:
 *     summary: Delete (deactivate) account
 *     description: |
 *       Soft deletes the account by setting `is_active: false`.
 *       Data is retained for compliance. The account cannot be used to login after this.
 *       This action is irreversible from the app — contact admin to reactivate.
 *     tags: [Farmer Auth]
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