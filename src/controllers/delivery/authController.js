const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const db = require("../../models");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// ─── Multer Storage Config ──────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const username = req.user?.mobile_number || "unknown";
    const subFolder = path.join(__dirname, "../../uploads", username, "profile");
    if (!fs.existsSync(subFolder)) fs.mkdirSync(subFolder, { recursive: true });
    cb(null, subFolder);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}_${file.fieldname}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ["image/jpeg", "image/png", "image/jpg", "image/webp"];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error("Only image files are allowed (jpeg, png, webp)"), false);
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });

exports.uploadProfilePhoto = upload.fields([{ name: "profile_photo", maxCount: 1 }]);

// ─── Generate JWT ───────────────────────────────────────────────────────────
const generateToken = (user) =>
  jwt.sign(
    { user_id: user.user_id, role: user.role, mobile_number: user.mobile_number },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );

// ─── POST /delivery/auth/login ──────────────────────────────────────────────
// Body: { mobile_number, password }
exports.login = async (req, res) => {
  try {
    const { mobile_number, password, fcm_token } = req.body;

    if (!mobile_number || !password) {
      return res.status(400).json({
        success: false,
        message: "mobile_number and password are required",
      });
    }

    const user = await db.User.findOne({
      where: { mobile_number, role: "delivery" },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid mobile number or password",
      });
    }

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: "Your account has been deactivated. Please contact admin.",
      });
    }

    // password_hash is the column name in the users table
    if (!user.password_hash) {
      return res.status(401).json({
        success: false,
        message: "Account has no password set. Please contact admin.",
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid mobile number or password",
      });
    }

    const updateData = { last_login: new Date() };
    if (fcm_token) {
      updateData.fcm_token = fcm_token;
    }
    await user.update(updateData);

    const deliveryProfile = await db.DeliveryPersonnel.findOne({
      where: { user_id: user.user_id },
    });

    const token = generateToken(user);

    return res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        user_id: user.user_id,
        mobile_number: user.mobile_number,
        role: user.role,
        profile_complete: user.profile_complete,
      },
      delivery_profile: deliveryProfile || null,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── PUT /delivery/auth/fcm-token ───────────────────────────────────────────
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

// ─── POST /delivery/auth/logout ─────────────────────────────────────────────
exports.logout = async (req, res) => {
  try {
    await db.User.update(
      { fcm_token: null },
      { where: { user_id: req.user.user_id } }
    );

    return res.json({ success: true, message: "Logged out successfully" });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── PUT /delivery/auth/change-password ─────────────────────────────────────
// Body: { current_password, new_password }
exports.changePassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({
        success: false,
        message: "current_password and new_password are required",
      });
    }

    if (new_password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "new_password must be at least 6 characters",
      });
    }

    const user = await db.User.findByPk(req.user.user_id);

    if (!user.password_hash) {
      return res.status(400).json({
        success: false,
        message: "No password set on this account. Please contact admin.",
      });
    }

    const isValid = await bcrypt.compare(current_password, user.password_hash);
    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    const hashed = await bcrypt.hash(new_password, 10);
    await user.update({ password_hash: hashed });

    return res.json({ success: true, message: "Password changed successfully" });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── POST /delivery/auth/create (admin only) ────────────────────────────────
// Body (multipart/form-data):
//   { mobile_number, password, full_name, vehicle_type, vehicle_number,
//     license_number?, license_expiry_date? }
// File: profile_photo (optional)
exports.createDeliveryAccount = async (req, res) => {
  try {
    const {
      mobile_number,
      password,
      full_name,
      vehicle_type,
      vehicle_number,
      license_number,
      license_expiry_date,
    } = req.body;

    if (!mobile_number || !password || !full_name || !vehicle_type || !vehicle_number) {
      return res.status(400).json({
        success: false,
        message: "mobile_number, password, full_name, vehicle_type, and vehicle_number are required",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "password must be at least 6 characters",
      });
    }

    const existingUser = await db.User.findOne({ where: { mobile_number } });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "A user with this mobile number already exists",
      });
    }

    // Store as password_hash to match the users table column
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await db.User.create({
      mobile_number,
      password_hash: hashedPassword,
      role: "delivery",
      is_active: true,
      is_verified: true,
      profile_complete: true,
    });

    let profile_photo_url = null;
    if (req.files?.profile_photo?.[0]) {
      const file = req.files.profile_photo[0];
      profile_photo_url = `/uploads/${mobile_number}/profile/${file.filename}`;
    }

    const dp = await db.DeliveryPersonnel.create({
      user_id: user.user_id,
      full_name,
      vehicle_type,
      vehicle_number,
      license_number: license_number || null,
      license_expiry_date: license_expiry_date || null,
      profile_photo_url,
    });

    return res.status(201).json({
      success: true,
      message: "Delivery account created successfully",
      data: {
        user: {
          user_id: user.user_id,
          mobile_number: user.mobile_number,
          role: user.role,
        },
        delivery_profile: dp,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── PUT /delivery/auth/reset-password (admin only) ─────────────────────────
// Body: { mobile_number, new_password }
// Admin resets a delivery person's forgotten password.
exports.resetPassword = async (req, res) => {
  try {
    const { mobile_number, new_password } = req.body;

    if (!mobile_number || !new_password) {
      return res.status(400).json({
        success: false,
        message: "mobile_number and new_password are required",
      });
    }

    if (new_password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "new_password must be at least 6 characters",
      });
    }

    const user = await db.User.findOne({
      where: { mobile_number, role: "delivery" },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Delivery person with this mobile number not found",
      });
    }

    const hashed = await bcrypt.hash(new_password, 10);
    await user.update({ password_hash: hashed });

    return res.json({
      success: true,
      message: `Password reset successfully for ${mobile_number}`,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};