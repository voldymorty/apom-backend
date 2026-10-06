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
    } else if (file.fieldname === "land_photo") {
      subFolder = path.join(__dirname, "../../uploads", username, "land");
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
  limits: { fileSize: 50 * 1024 * 1024 },
});

exports.uploadProfileImages = upload.fields([
  { name: "profile_photo", maxCount: 1 },
  { name: "land_photo", maxCount: 1 },
]);

// ─── Generate JWT ──────────────────────────────────────────────
const generateToken = (user) =>
  jwt.sign(
    { user_id: user.user_id, role: user.role, mobile_number: user.mobile_number },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );

// ─── STEP 1: POST /auth/send-otp ──────────────────────────────
exports.sendOtp = async (req, res) => {
  try {
    const { mobile_number, role } = req.body;

    const existingUser = await db.User.findOne({
      where: { mobile_number },
    });

    if (existingUser && existingUser.role !== role) {
      return res.status(403).json({
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
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── STEP 2: POST /auth/verify-otp ────────────────────────────
exports.verifyOtp = async (req, res) => {
  try {
    const { mobile_number, otp_code } = req.body;

    const otpRecord = await db.OtpVerification.findOne({
      where: { mobile_number, otp_code, is_verified: false },
    });

    // if (!otpRecord) {
    //   return res.status(400).json({ success: false, message: "Invalid OTP" });
    // }

    // if (new Date() > otpRecord.expires_at) {
    //   return res.status(400).json({ success: false, message: "OTP has expired. Please request a new one." });
    // }

    // await otpRecord.update({ is_verified: true, verified_at: new Date() });

    // ─── Reviewer OTP bypass (Play Store / App Store review access only) ───
    // Scoped to a whitelist of reviewer numbers set via env var, e.g.:
    // REVIEWER_MOBILE_NUMBERS=9999999999,8888888888
    // REVIEWER_OTP_CODE=123456
    const reviewerNumbers = (process.env.REVIEWER_MOBILE_NUMBERS || "")
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean);
    const reviewerOtp = process.env.REVIEWER_OTP_CODE || "1234";

    const isBypass =
      reviewerNumbers.includes(mobile_number) && otp_code === reviewerOtp;

    if (!isBypass) {
      if (!otpRecord) {
        return res.status(400).json({ success: false, message: "Invalid OTP" });
      }

      if (new Date() > otpRecord.expires_at) {
        return res.status(400).json({ success: false, message: "OTP has expired. Please request a new one." });
      }

      await otpRecord.update({ is_verified: true, verified_at: new Date() });
    }

    // end

    let [user, created] = await db.User.findOrCreate({
      where: { mobile_number },
      defaults: {
        mobile_number,
        // role: otpRecord.role,
        role: isBypass ? "farmer" : otpRecord.role, // remove in prod
        password_hash: null,
        is_verified: true,
        last_login: new Date(),
        fcm_token: req.body.fcm_token || null,
      },
    });

    if (!created) {
      await user.update({
        last_login: new Date(),
        is_verified: true,
        fcm_token: req.body.fcm_token || user.fcm_token,
      });

      await user.reload();
    }

    const token = generateToken(user);

    return res.json({
      success: true,
      message: "OTP verified successfully",
      data: {
        user_id: user.user_id,
        mobile_number: user.mobile_number,
        role: user.role,
        is_verified: user.is_verified,
        profile_complete: user.profile_complete,
        token,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── STEP 3: POST /auth/setup-profile ─────────────────────────
exports.setupProfile = async (req, res) => {
  try {
    const user = await db.User.findByPk(req.user.user_id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    if (user.profile_complete) {
      return res.status(400).json({ success: false, message: "Profile already set up" });
    }

    const role = user.role;
    const username = user.mobile_number;
    const baseUrl = `${req.protocol}://${req.get("host")}`;

    if (role === "farmer") {
      const existing = await db.Farmer.findOne({ where: { user_id: user.user_id } });
      if (existing) return res.status(409).json({ success: false, message: "Farmer profile already exists" });

      const {
        full_name, aadhar_number, farm_name,
        location_address, pincode,
        state_id, district_id, city_id,
        latitude, longitude,
        total_land, land_unit,
        land_segments,
      } = req.body;

      if (aadhar_number && aadhar_number.length !== 12) {
        return res.status(400).json({ success: false, message: "Aadhar number must be exactly 12 digits" });
      }

      const profile_photo_url = req.files?.profile_photo?.[0]
        ? `${baseUrl}/uploads/${username}/profile/${req.files.profile_photo[0].filename}`
        : null;
      const land_photo_url = req.files?.land_photo?.[0]
        ? `${baseUrl}/uploads/${username}/land/${req.files.land_photo[0].filename}`
        : null;

      let parsedSegments = land_segments;
      if (typeof land_segments === "string") {
        try { parsedSegments = JSON.parse(land_segments); } catch { parsedSegments = []; }
      }

      if (!Array.isArray(parsedSegments) || parsedSegments.length === 0) {
        return res.status(400).json({ success: false, message: "At least one land segment is required" });
      }

      const segmentTotal = parsedSegments.reduce((sum, s) => sum + parseFloat(s.area_value || 0), 0);
      const totalLandNum = parseFloat(total_land);

      // Crop partitions only represent land currently allocated to crops —
      // they no longer need to add up to the total. The remainder is
      // automatically treated as fallow land. We only reject over-allocation.
      if (segmentTotal - totalLandNum > 0.01) {
        return res.status(400).json({
          success: false,
          message: `Allocated crop land (${segmentTotal}) cannot exceed total land (${total_land})`,
        });
      }

      // Resolve product_id → snapshot product_name server-side so crop_name
      // is always sourced from the Crop API, not client-typed text.
      const productIds = parsedSegments
        .map((s) => parseInt(s.product_id, 10))
        .filter((id) => !Number.isNaN(id));
      const products = productIds.length
        ? await db.Product.findAll({ where: { product_id: productIds } })
        : [];
      const productMap = new Map(products.map((p) => [p.product_id, p]));

      for (const s of parsedSegments) {
        const productId = parseInt(s.product_id, 10);
        if (Number.isNaN(productId) || !productMap.has(productId)) {
          return res.status(400).json({
            success: false,
            message: "Each land segment must reference a valid product_id from the crop catalog",
          });
        }
      }

      const farmer = await db.Farmer.create({
        user_id: user.user_id,
        full_name,
        aadhar_number: aadhar_number || null,
        farm_name,
        location_address,
        pincode,
        state_id: state_id || null,
        district_id: district_id || null,
        city_id: city_id || null,
        latitude,
        longitude,
        total_land,
        land_unit: land_unit || "acres",
        allocated_land: segmentTotal,
        available_land: Math.max(0, totalLandNum - segmentTotal),
        profile_photo_url,
        land_photo_url,
      });

      const segmentRows = parsedSegments.map((s) => {
        const product = productMap.get(parseInt(s.product_id, 10));
        return {
          farmer_id: farmer.farmer_id,
          product_id: product.product_id,
          crop_name: product.product_name,
          area_value: s.area_value,
          area_unit: land_unit || "acres",
          expected_yield_value: s.expected_yield_value != null ? parseFloat(s.expected_yield_value) : null,
          expected_yield_unit: s.expected_yield_unit || "kg",
          plantation_date: s.plantation_date,
          harvesting_date: s.harvesting_date,
        };
      });

      await db.LandSegment.bulkCreate(segmentRows);

    } else if (role === "vendor") {
      const existing = await db.Vendor.findOne({ where: { user_id: user.user_id } });
      if (existing) return res.status(409).json({ success: false, message: "Vendor profile already exists" });

      const { business_name, owner_name, business_type, gst_number, fssai_number } = req.body;

      await db.Vendor.create({
        user_id: user.user_id,
        business_name, owner_name, business_type, gst_number, fssai_number,
      });

    } else if (role === "delivery") {
      const existing = await db.DeliveryPersonnel.findOne({ where: { user_id: user.user_id } });
      if (existing) return res.status(409).json({ success: false, message: "Delivery profile already exists" });

      const {
        full_name, vehicle_type, vehicle_number,
        license_number, license_expiry_date,
      } = req.body;

      const profile_photo_url = req.files?.profile_photo?.[0]
        ? `${baseUrl}/uploads/${username}/profile/${req.files.profile_photo[0].filename}`
        : null;

      await db.DeliveryPersonnel.create({
        user_id: user.user_id,
        full_name, vehicle_type, vehicle_number,
        license_number, license_expiry_date, profile_photo_url,
      });

    } else {
      return res.status(400).json({ success: false, message: `Profile setup not required for role: ${role}` });
    }

    await user.update({ profile_complete: true });

    return res.status(201).json({
      success: true,
      message: "Profile setup completed successfully",
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── GET /auth/me ──────────────────────────────────────────────
exports.getMe = async (req, res) => {
  try {
    const user = await db.User.findByPk(req.user.user_id, {
      attributes: { exclude: ["password_hash"] },
    });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    let profileData = null;

    if (user.role === "farmer") {
      profileData = await db.Farmer.findOne({
        where: { user_id: user.user_id },
        include: [
          { model: db.LandSegment, as: "land_segments" },
          { model: db.State,    as: "state_info",    attributes: ["state_id", "state_name", "state_code"] },
          { model: db.District, as: "district_info", attributes: ["district_id", "district_name"] },
          { model: db.City,     as: "city_info",     attributes: ["city_id", "city_name"] },
        ],
      });
    } else if (user.role === "vendor") {
      profileData = await db.Vendor.findOne({
        where: { user_id: user.user_id },
        include: [{ model: db.VendorAddress, as: "addresses" }],
      });
    } else if (user.role === "delivery") {
      profileData = await db.DeliveryPersonnel.findOne({
        where: { user_id: user.user_id },
      });
    }

    return res.json({
      success: true,
      data: { ...user.toJSON(), profile: profileData },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── PUT /auth/edit-profile ────────────────────────────────────
// multipart/form-data — updates role-specific profile + optional photo
exports.editProfile = async (req, res) => {
  try {
    const user = await db.User.findByPk(req.user.user_id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const role = user.role;
    const username = user.mobile_number;
    const baseUrl = `${req.protocol}://${req.get("host")}`;

    // Update user-level email if provided
    if (req.body.email) {
      await user.update({ email: req.body.email });
    }

    if (role === "farmer") {
      const farmer = await db.Farmer.findOne({ where: { user_id: user.user_id } });
      if (!farmer) return res.status(404).json({ success: false, message: "Farmer profile not found" });

      const {
        full_name, farm_name, location_address,
        pincode, state_id, district_id, city_id,
        latitude, longitude, total_land, land_unit,
      } = req.body;

      // New profile photo
      const profile_photo_url = req.files?.profile_photo?.[0]
        ? `${baseUrl}/uploads/${username}/profile/${req.files.profile_photo[0].filename}`
        : farmer.profile_photo_url;

      // New land photo
      const land_photo_url = req.files?.land_photo?.[0]
        ? `${baseUrl}/uploads/${username}/land/${req.files.land_photo[0].filename}`
        : farmer.land_photo_url;

      // Changing total_land must keep Total Land = Cultivated + Fallow intact.
      // Cultivated (allocated_land) is the real source of truth — recompute
      // it from actual segments rather than trusting the possibly-stale
      // farmer.allocated_land column, then reject shrinking below it and
      // recompute available_land (fallow) for the new total.
      let newTotalLand = farmer.total_land;
      let newAvailableLand = farmer.available_land;

      if (total_land !== undefined && total_land !== null && total_land !== "") {
        const parsedTotal = parseFloat(total_land);
        if (Number.isNaN(parsedTotal) || parsedTotal <= 0) {
          return res.status(400).json({ success: false, message: "total_land must be a positive number" });
        }

        const cultivated = await db.LandSegment.sum("area_value", {
          where: { farmer_id: farmer.farmer_id },
        }) || 0;

        if (parsedTotal - cultivated < -0.01) {
          return res.status(400).json({
            success: false,
            message: `Total land cannot be less than currently cultivated land (${cultivated}). Reduce or remove crop partitions first.`,
          });
        }

        newTotalLand = parsedTotal;
        newAvailableLand = Math.max(0, parsedTotal - cultivated);
      }

      await farmer.update({
        full_name:        full_name        || farmer.full_name,
        farm_name:        farm_name        !== undefined ? farm_name : farmer.farm_name,
        location_address: location_address || farmer.location_address,
        pincode:          pincode          || farmer.pincode,
        state_id:         state_id         || farmer.state_id,
        district_id:      district_id      || farmer.district_id,
        city_id:          city_id          || farmer.city_id,
        latitude:         latitude         || farmer.latitude,
        longitude:        longitude        || farmer.longitude,
        total_land:       newTotalLand,
        available_land:   newAvailableLand,
        land_unit:        land_unit        || farmer.land_unit,
        profile_photo_url,
        land_photo_url,
      });

      return res.json({ success: true, message: "Farmer profile updated", data: farmer });

    } else if (role === "vendor") {
      const vendor = await db.Vendor.findOne({ where: { user_id: user.user_id } });
      if (!vendor) return res.status(404).json({ success: false, message: "Vendor profile not found" });

      const { business_name, owner_name, business_type, gst_number, fssai_number } = req.body;

      await vendor.update({
        business_name: business_name || vendor.business_name,
        owner_name:    owner_name    || vendor.owner_name,
        business_type: business_type || vendor.business_type,
        gst_number:    gst_number    !== undefined ? gst_number : vendor.gst_number,
        fssai_number:  fssai_number  !== undefined ? fssai_number : vendor.fssai_number,
      });

      return res.json({ success: true, message: "Vendor profile updated", data: vendor });

    } else if (role === "delivery") {
      const dp = await db.DeliveryPersonnel.findOne({ where: { user_id: user.user_id } });
      if (!dp) return res.status(404).json({ success: false, message: "Delivery profile not found" });

      const { full_name, vehicle_type, vehicle_number, license_number, license_expiry_date } = req.body;

      const profile_photo_url = req.files?.profile_photo?.[0]
        ? `${baseUrl}/uploads/${username}/profile/${req.files.profile_photo[0].filename}`
        : dp.profile_photo_url;

      await dp.update({
        full_name:           full_name           || dp.full_name,
        vehicle_type:        vehicle_type        || dp.vehicle_type,
        vehicle_number:      vehicle_number      || dp.vehicle_number,
        license_number:      license_number      || dp.license_number,
        license_expiry_date: license_expiry_date || dp.license_expiry_date,
        profile_photo_url,
      });

      return res.json({ success: true, message: "Delivery profile updated", data: dp });

    } else {
      return res.status(400).json({ success: false, message: `Edit not supported for role: ${role}` });
    }
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── PUT /auth/fcm-token ───────────────────────────────────────
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

// ─── POST /auth/logout ─────────────────────────────────────────
exports.logout = async (req, res) => {
  try {
    // Clear FCM token so no push notifications after logout
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

// ─── DELETE /auth/account ──────────────────────────────────────
// Soft delete — deactivates account, does NOT destroy DB records
exports.deleteAccount = async (req, res) => {
  try {
    const user = await db.User.findByPk(req.user.user_id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    // Soft delete: deactivate and clear sensitive tokens
    await user.update({
      is_active:  false,
      fcm_token:  null,
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