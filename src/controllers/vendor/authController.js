const jwt = require("jsonwebtoken");
const db = require("../../models");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// ─── Multer Storage Config ─────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const username = req.user?.mobile_number || "unknown";
    let subFolder;
    if (file.fieldname === "profile_photo") {
      subFolder = path.join(__dirname, "../../uploads", username, "profile");
    } else if (file.fieldname === "shop_photo") {
      subFolder = path.join(__dirname, "../../uploads", username, "shop");
    } else {
      subFolder = path.join(__dirname, "../../uploads", username, "other");
    }
    if (!fs.existsSync(subFolder)) fs.mkdirSync(subFolder, { recursive: true });
    cb(null, subFolder);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${Date.now()}_${file.fieldname}${ext}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ["image/jpeg", "image/png", "image/jpg", "image/webp"];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error("Only image files are allowed (jpeg, png, webp)"), false);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

exports.uploadProfileImages = upload.fields([
  { name: "profile_photo", maxCount: 1 },
  { name: "shop_photo", maxCount: 1 },
]);

// ─── Generate JWT ──────────────────────────────────────────────
const generateToken = (user) =>
  jwt.sign(
    { user_id: user.user_id, role: user.role, mobile_number: user.mobile_number },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );

// ─── STEP 1: POST /vendor/auth/send-otp ───────────────────────
exports.sendOtp = async (req, res) => {
  try {
    const { mobile_number, role } = req.body;

    // Check if number already exists under a different role
    const existingUser = await db.User.findOne({
      where: { mobile_number },
    });

    if (existingUser && existingUser.role !== role) {
      return res.status(409).json({
        success: false,
        message: `This mobile number is already registered as '${existingUser.role}'.`,
      });
    }

    await db.OtpVerification.update(
      { is_verified: true },
      { where: { mobile_number, is_verified: false } }
    );

    const otp_code = Math.floor(1000 + Math.random() * 9000).toString();

    await db.OtpVerification.create({
      mobile_number,
      otp_code,
      otp_type: "login",
      role,
      expires_at: new Date(Date.now() + 10 * 60 * 1000),
    });

    return res.json({
      success: true,
      message: "OTP sent successfully",
      otp: otp_code,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ─── STEP 2: POST /vendor/auth/verify-otp ─────────────────────
exports.verifyOtp = async (req, res) => {
  try {
    const { mobile_number, otp_code } = req.body;

    const otpRecord = await db.OtpVerification.findOne({
      where: { mobile_number, otp_code, is_verified: false },
    });

    if (!otpRecord) {
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }

    if (new Date() > otpRecord.expires_at) {
      return res.status(400).json({ success: false, message: "OTP has expired. Please request a new one." });
    }

    await otpRecord.update({ is_verified: true, verified_at: new Date() });

    // ─── TEMP: master OTP bypass (remove before production) ───────
    // const isBypass = otp_code === "1234";

    // if (!isBypass) {
    //   const otpRecord = await db.OtpVerification.findOne({
    //     where: { mobile_number, otp_code, is_verified: false },
    //   });

    //   if (!otpRecord) {
    //     return res.status(400).json({ success: false, message: "Invalid OTP" });
    //   }

    //   if (new Date() > otpRecord.expires_at) {
    //     return res.status(400).json({ success: false, message: "OTP has expired. Please request a new one." });
    //   }

    //   await otpRecord.update({ is_verified: true, verified_at: new Date() });
    // }
    // ──────────────────────────────────────────────────────────────

    // Check if number already exists under a different role
    const existingUser = await db.User.findOne({ where: { mobile_number } });

    if (existingUser && existingUser.role !== "vendor") {
      return res.status(409).json({
        success: false,
        message: `This mobile number is already registered as a '${existingUser.role}'. Please use a different number to register as 'vendor'.`,
      });
    }

    let [user, created] = await db.User.findOrCreate({
      where: { mobile_number },
      defaults: {
        mobile_number,
        role:          "vendor",
        password_hash: null,
        is_verified:   true,
        last_login:    new Date(),
        fcm_token:     req.body.fcm_token || null,
      },
    });

    if (!created) {
      await user.update({
        last_login:  new Date(),
        is_verified: true,
        fcm_token:   req.body.fcm_token || user.fcm_token,
      });
      await user.reload();
    }

    const token = generateToken(user);

    return res.json({
      success: true,
      message: "OTP verified successfully",
      data: {
        user_id:          user.user_id,
        mobile_number:    user.mobile_number,
        role:             user.role,
        is_verified:      user.is_verified,
        profile_complete: user.profile_complete,
        token,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── STEP 3: POST /vendor/auth/setup-profile ──────────────────
// Body (multipart/form-data):
//   business_name*, owner_name*, location_address*, pincode*,
//   shop_photo* (file), profile_photo (file),
//   business_type, gst_number, state_id, district_id, city_id,
//   latitude, longitude,
//   address_line1*, city*, state*,
//   address_label (default "Main Shop"), address_line2, landmark,
//   contact_person, contact_number
exports.setupProfile = async (req, res) => {
  try {
    console.log("========== SETUP PROFILE ==========");
    console.log("User ID:", req.user.user_id);
    console.log("Request Body:", req.body);

    console.log("Files:", req.files);

    const user = await db.User.findByPk(req.user.user_id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    if (user.role !== "vendor") {
      return res.status(403).json({ success: false, message: "This endpoint is for vendors only" });
    }
    if (user.profile_complete) {
      return res.status(400).json({ success: false, message: "Profile already set up" });
    }

    const existing = await db.Vendor.findOne({ where: { user_id: user.user_id } });
    if (existing) {
      return res.status(409).json({ success: false, message: "Vendor profile already exists" });
    }

    const {
      business_name,
      owner_name,
      business_type,
      gst_number,
      location_address,
      pincode,
      state_id,
      district_id,
      city_id,
      latitude,
      longitude,
      // Delivery address fields
      address_label,
      contact_person,
      contact_number,
      address_line1,
      address_line2,
      landmark,
      city,
      district,
      state,
    } = req.body;

    console.log("Latitude:", latitude);
    console.log("Longitude:", longitude);

    // ── Validation ─────────────────────────────────────────────
    if (!business_name?.trim()) {
      return res.status(400).json({ success: false, message: "Shop name is required" });
    }
    if (!owner_name?.trim()) {
      return res.status(400).json({ success: false, message: "Owner name is required" });
    }
    if (!location_address?.trim()) {
      return res.status(400).json({ success: false, message: "Shop address is required" });
    }
    if (!pincode?.trim() || pincode.trim().length !== 6) {
      return res.status(400).json({ success: false, message: "A valid 6-digit pincode is required" });
    }

    if (
      latitude === undefined ||
      latitude === null ||
      longitude === undefined ||
      longitude === null
    ) {
      return res.status(400).json({
        success: false,
        message: "Latitude and longitude are required"
      });
    }

    if (!address_line1?.trim()) {
      return res.status(400).json({ success: false, message: "address_line1 is required for delivery address" });
    }
    if (!city?.trim()) {
      return res.status(400).json({ success: false, message: "city is required for delivery address" });
    }

    if (!district?.trim()) {
      return res.status(400).json({ success: false, message: "district is required for delivery address" });
    }

    if (!state?.trim()) {
      return res.status(400).json({ success: false, message: "state is required for delivery address" });
    }

    const username = user.mobile_number;
    const baseUrl  = `${req.protocol}://${req.get("host")}`;

    const vendor_photo_url = req.files?.profile_photo?.[0]
      ? `${baseUrl}/uploads/${username}/profile/${req.files.profile_photo[0].filename}`
      : null;

    const shop_photo_url = req.files?.shop_photo?.[0]
      ? `${baseUrl}/uploads/${username}/shop/${req.files.shop_photo[0].filename}`
      : null;

    if (!shop_photo_url) {
      return res.status(400).json({ success: false, message: "Shop photo is required" });
    }

    // ── Create vendor ──────────────────────────────────────────
    const vendor = await db.Vendor.create({
      user_id:         user.user_id,
      shop_name:       business_name.trim(),
      owner_name:      owner_name.trim(),
      business_type:   business_type      || "retail",
      gst_number:      gst_number?.trim() || null,
      primary_address: location_address.trim(),
      pincode:         pincode.trim(),
      state_id:        state_id    || null,
      district_id:     district_id || null,
      city_id:         city_id     || null,
      latitude:        latitude    || null,
      longitude:       longitude   || null,
      vendor_photo_url,
      shop_photo_url,
    });

    console.log("Vendor Created:");
    console.log({
      vendor_id: vendor.vendor_id,
      latitude: vendor.latitude,
      longitude: vendor.longitude
    });

    // ── Save primary address to vendor_addresses ───────────────
    const address = await db.VendorAddress.create({
      vendor_id:      vendor.vendor_id,
      address_label:  address_label?.trim()  || "Main Shop",
      contact_person: contact_person?.trim() || owner_name.trim(),
      contact_number: contact_number?.trim() || user.mobile_number,
      address_line1:  address_line1.trim(),
      address_line2:  address_line2?.trim()  || null,
      landmark:       landmark?.trim()       || null,
      city:           city.trim(),
      district:       district.trim(),
      state:          state.trim(),
      pincode:        pincode.trim(),
      latitude:       latitude  || null,
      longitude:      longitude || null,
      is_default:     true,
      is_active:      true,
    });

    console.log("Vendor Address Created:");
    console.log({
      address_id: address.address_id,
      latitude: address.latitude,
      longitude: address.longitude
    });

    await user.update({ profile_complete: true });

    const createdVendor = await db.Vendor.findByPk(vendor.vendor_id);

    console.log(
      "Stored Vendor Coordinates:",
      createdVendor.latitude,
      createdVendor.longitude
    );

    return res.status(201).json({
      success: true,
      message: "Vendor profile setup completed successfully",
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── GET /vendor/auth/me ───────────────────────────────────────
exports.getMe = async (req, res) => {
  try {
    const user = await db.User.findByPk(req.user.user_id, {
      attributes: { exclude: ["password_hash"] },
    });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    if (user.role !== "vendor") {
      return res.status(403).json({ success: false, message: "This endpoint is for vendors only" });
    }

    const profileData = await db.Vendor.findOne({
      where: { user_id: user.user_id },
      include: [
        {
          model: db.VendorAddress,
          as: "addresses",
          where: { is_active: true },
          required: false,
        },
        { model: db.State,    as: "state_info",    attributes: ["state_id", "state_name", "state_code"] },
        { model: db.District, as: "district_info", attributes: ["district_id", "district_name"] },
        { model: db.City,     as: "city_info",     attributes: ["city_id", "city_name"] },
      ],
    });

    return res.json({
      success: true,
      data: { ...user.toJSON(), profile: profileData },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── PUT /vendor/auth/edit-profile ────────────────────────────
exports.editProfile = async (req, res) => {
  try {
    const user = await db.User.findByPk(req.user.user_id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    if (user.role !== "vendor") {
      return res.status(403).json({ success: false, message: "This endpoint is for vendors only" });
    }

    const vendor = await db.Vendor.findOne({ where: { user_id: user.user_id } });
    if (!vendor) return res.status(404).json({ success: false, message: "Vendor profile not found" });

    if (req.body.email) {
      await user.update({ email: req.body.email });
    }

    const {
      business_name,
      owner_name,
      business_type,
      gst_number,
      location_address,
      pincode,
      state_id,
      district_id,
      city_id,
      latitude,
      longitude,
    } = req.body;

    if (pincode && pincode.trim().length !== 6) {
      return res.status(400).json({ success: false, message: "Pincode must be exactly 6 digits" });
    }

    const username = user.mobile_number;
    const baseUrl  = `${req.protocol}://${req.get("host")}`;

    const vendor_photo_url = req.files?.profile_photo?.[0]
      ? `${baseUrl}/uploads/${username}/profile/${req.files.profile_photo[0].filename}`
      : vendor.vendor_photo_url;

    const shop_photo_url = req.files?.shop_photo?.[0]
      ? `${baseUrl}/uploads/${username}/shop/${req.files.shop_photo[0].filename}`
      : vendor.shop_photo_url;

    await vendor.update({
      shop_name:       business_name?.trim()    || vendor.shop_name,
      owner_name:      owner_name?.trim()       || vendor.owner_name,
      business_type:   business_type            || vendor.business_type,
      gst_number:      gst_number !== undefined  ? gst_number : vendor.gst_number,
      primary_address: location_address?.trim() || vendor.primary_address,
      pincode:         pincode?.trim()          || vendor.pincode,
      state_id:        state_id    || vendor.state_id,
      district_id:     district_id || vendor.district_id,
      city_id:         city_id     || vendor.city_id,
      latitude:        latitude    || vendor.latitude,
      longitude:       longitude   || vendor.longitude,
      vendor_photo_url,
      shop_photo_url,
    });

    return res.json({
      success: true,
      message: "Vendor profile updated successfully",
      data: vendor,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── PUT /vendor/auth/fcm-token ───────────────────────────────
exports.updateFcmToken = async (req, res) => {
  try {
    const { fcm_token } = req.body;
    if (!fcm_token) {
      return res.status(400).json({ success: false, message: "fcm_token is required" });
    }
    await db.User.update(
      { fcm_token },
      { where: { user_id: req.user.user_id } }
    );
    return res.json({ success: true, message: "FCM token updated successfully" });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── POST /vendor/auth/logout ──────────────────────────────────
exports.logout = async (req, res) => {
  try {
    await db.User.update(
      { fcm_token: null },
      { where: { user_id: req.user.user_id } }
    );

    return res.json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── DELETE /vendor/auth/account ──────────────────────────────
exports.deleteAccount = async (req, res) => {
  try {
    const user = await db.User.findByPk(req.user.user_id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    await user.update({
      is_active:   false,
      fcm_token:   null,
      is_verified: false,
    });

    return res.json({
      success: true,
      message: "Account deactivated successfully. Your data has been retained for compliance purposes.",
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};