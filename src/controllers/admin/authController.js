const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { User } = require("../../models");

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = "12h";
const BCRYPT_ROUNDS = 10;

// ─── Helpers ────────────────────────────────────────────────────────────────

const generateToken = (user) =>
  jwt.sign(
    { user_id: user.user_id, role: user.role, mobile_number: user.mobile_number },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

const successResponse = (res, statusCode, message, data = null) => {
  const payload = { success: true, message };
  if (data !== null) payload.data = data;
  return res.status(statusCode).json(payload);
};

const errorResponse = (res, statusCode, message, error = null) => {
  const payload = { success: false, message };
  if (error && process.env.NODE_ENV === "development") payload.error = error;
  return res.status(statusCode).json(payload);
};

// ─── Controllers ────────────────────────────────────────────────────────────

/**
 * POST /api/admin/auth/create-first-admin
 * Creates the very first admin. Blocked if any admin already exists.
 * Should be disabled or protected via env flag in production after first use.
 */
const createFirstAdmin = async (req, res) => {
  try {
    const { mobile_number, password, email } = req.body;

    // Validate required fields
    if (!mobile_number || !password) {
      return errorResponse(res, 400, "mobile_number and password are required");
    }

    if (password.length < 8) {
      return errorResponse(res, 400, "Password must be at least 8 characters");
    }

    // Block if any admin already exists
    const existingAdmin = await User.findOne({
      where: { role: "admin" },
      attributes: ["user_id"],
    });

    if (existingAdmin) {
      return errorResponse(
        res,
        409,
        "An admin account already exists. Use the login endpoint."
      );
    }

    // Check mobile not already taken
    const mobileExists = await User.findOne({ where: { mobile_number } });
    if (mobileExists) {
      return errorResponse(res, 409, "Mobile number already registered");
    }

    const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const admin = await User.create({
      mobile_number,
      password_hash,
      role: "admin",
      is_active: 1,
      is_verified: 1,
      profile_complete: 1,
      email: email || null,
    });

    const token = generateToken(admin);

    return successResponse(res, 201, "Admin account created successfully", {
      token,
      admin: {
        user_id: admin.user_id,
        mobile_number: admin.mobile_number,
        email: admin.email,
        role: admin.role,
        created_at: admin.created_at,
      },
    });
  } catch (err) {
    console.error("[createFirstAdmin]", err);
    return errorResponse(res, 500, "Internal server error", err.message);
  }
};


/**
 * POST /api/admin/auth/create-admin
 * Create a new admin account. Requires an existing logged-in admin (JWT protected).
 */
const createAdmin = async (req, res) => {
  try {
    const { mobile_number, password, email } = req.body;

    if (!mobile_number || !password) {
      return errorResponse(res, 400, "mobile_number and password are required");
    }

    if (password.length < 8) {
      return errorResponse(res, 400, "Password must be at least 8 characters");
    }

    const mobileExists = await User.findOne({ where: { mobile_number } });
    if (mobileExists) {
      return errorResponse(res, 409, "Mobile number already registered");
    }

    const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const admin = await User.create({
      mobile_number,
      password_hash,
      role: "admin",
      is_active: 1,
      is_verified: 1,
      profile_complete: 1,
      email: email || null,
    });

    return successResponse(res, 201, "Admin account created successfully", {
      admin: {
        user_id: admin.user_id,
        mobile_number: admin.mobile_number,
        email: admin.email,
        role: admin.role,
        created_at: admin.created_at,
      },
    });
  } catch (err) {
    console.error("[createAdmin]", err);
    return errorResponse(res, 500, "Internal server error", err.message);
  }
};

/**
 * POST /api/admin/auth/login
 */
const login = async (req, res) => {
  try {
    const { mobile_number, password } = req.body;

    if (!mobile_number || !password) {
      return errorResponse(res, 400, "mobile_number and password are required");
    }

    const admin = await User.findOne({
      where: { mobile_number, role: "admin" },
    });

    if (!admin) {
      return errorResponse(res, 401, "Invalid credentials");
    }

    if (!admin.is_active) {
      return errorResponse(res, 403, "Account is deactivated. Contact support.");
    }

    const isPasswordValid = await bcrypt.compare(password, admin.password_hash);
    if (!isPasswordValid) {
      return errorResponse(res, 401, "Invalid credentials");
    }

    // Update last_login
    await admin.update({ last_login: new Date() });

    const token = generateToken(admin);

    return successResponse(res, 200, "Login successful", {
      token,
      expires_in: "2h",
      admin: {
        user_id: admin.user_id,
        mobile_number: admin.mobile_number,
        email: admin.email,
        role: admin.role,
        last_login: admin.last_login,
      },
    });
  } catch (err) {
    console.error("[login]", err);
    return errorResponse(res, 500, "Internal server error", err.message);
  }
};

/**
 * GET /api/admin/auth/me
 * Get the currently authenticated admin's profile.
 */
const getMe = async (req, res) => {
  try {
    const admin = await User.findOne({
      where: { user_id: req.user.user_id, role: "admin" },
      attributes: [
        "user_id",
        "mobile_number",
        "email",
        "role",
        "is_active",
        "is_verified",
        "profile_complete",
        "created_at",
        "updated_at",
        "last_login",
      ],
    });

    if (!admin) {
      return errorResponse(res, 404, "Admin not found");
    }

    return successResponse(res, 200, "Admin profile fetched", admin);
  } catch (err) {
    console.error("[getMe]", err);
    return errorResponse(res, 500, "Internal server error", err.message);
  }
};

/**
 * GET /api/admin/auth/list
 * Get all admin accounts. (Super-admin use case if you ever have multiple admins)
 */
const getAllAdmins = async (req, res) => {
  try {
    const admins = await User.findAll({
      where: { role: "admin" },
      attributes: [
        "user_id",
        "mobile_number",
        "email",
        "is_active",
        "is_verified",
        "created_at",
        "last_login",
      ],
      order: [["created_at", "ASC"]],
    });

    return successResponse(res, 200, "Admins fetched", {
      count: admins.length,
      admins,
    });
  } catch (err) {
    console.error("[getAllAdmins]", err);
    return errorResponse(res, 500, "Internal server error", err.message);
  }
};

/**
 * GET /api/admin/auth/:user_id
 * Get a specific admin by user_id.
 */
const getAdminById = async (req, res) => {
  try {
    const { user_id } = req.params;

    const admin = await User.findOne({
      where: { user_id, role: "admin" },
      attributes: [
        "user_id",
        "mobile_number",
        "email",
        "is_active",
        "is_verified",
        "profile_complete",
        "created_at",
        "updated_at",
        "last_login",
      ],
    });

    if (!admin) {
      return errorResponse(res, 404, "Admin not found");
    }

    return successResponse(res, 200, "Admin fetched", admin);
  } catch (err) {
    console.error("[getAdminById]", err);
    return errorResponse(res, 500, "Internal server error", err.message);
  }
};

/**
 * DELETE /api/admin/auth/:user_id/soft
 * Soft delete — sets is_active = 0. Admin cannot login but record is retained.
 * Cannot soft-delete your own account.
 */
const softDeleteAdmin = async (req, res) => {
  try {
    const { user_id } = req.params;

    const userIdParam = Number(user_id);
    const loggedInUserId = Number(req.user.user_id);

    if (userIdParam === loggedInUserId) {
      return errorResponse(res, 400, "You cannot deactivate your own account");
    }

    const admin = await User.findOne({ where: { user_id, role: "admin" } });

    if (!admin) {
      return errorResponse(res, 404, "Admin not found");
    }

    if (!admin.is_active) {
      return errorResponse(res, 409, "Admin is already deactivated");
    }

    await admin.update({ is_active: 0 });

    return successResponse(res, 200, "Admin account deactivated successfully", {
      user_id: admin.user_id,
      mobile_number: admin.mobile_number,
      is_active: 0,
    });
  } catch (err) {
    console.error("[softDeleteAdmin]", err);
    return errorResponse(res, 500, "Internal server error", err.message);
  }
};

/**
 * DELETE /api/admin/auth/:user_id/hard
 * Hard delete — permanently removes the admin user record.
 * Cannot hard-delete your own account.
 */
const hardDeleteAdmin = async (req, res) => {
  try {
    const { user_id } = req.params;

    const userIdParam = Number(user_id);
    const loggedInUserId = Number(req.user.user_id);

    if (userIdParam === loggedInUserId) {
      return errorResponse(res, 400, "You cannot delete your own account");
    }

    const admin = await User.findOne({ where: { user_id, role: "admin" } });

    if (!admin) {
      return errorResponse(res, 404, "Admin not found");
    }

    await admin.destroy();

    return successResponse(
      res,
      200,
      "Admin account permanently deleted",
      { user_id }
    );
  } catch (err) {
    console.error("[hardDeleteAdmin]", err);
    return errorResponse(res, 500, "Internal server error", err.message);
  }
};

/**
 * PATCH /api/admin/auth/:user_id/restore
 * Restore a soft-deleted (deactivated) admin account.
 */
const restoreAdmin = async (req, res) => {
  try {
    const { user_id } = req.params;

    const admin = await User.findOne({ where: { user_id, role: "admin" } });

    if (!admin) {
      return errorResponse(res, 404, "Admin not found");
    }

    if (admin.is_active) {
      return errorResponse(res, 409, "Admin is already active");
    }

    await admin.update({ is_active: 1 });

    return successResponse(res, 200, "Admin account restored successfully", {
      user_id: admin.user_id,
      mobile_number: admin.mobile_number,
      is_active: 1,
    });
  } catch (err) {
    console.error("[restoreAdmin]", err);
    return errorResponse(res, 500, "Internal server error", err.message);
  }
};

module.exports = {
  createAdmin,
  createFirstAdmin,
  login,
  getMe,
  getAllAdmins,
  getAdminById,
  softDeleteAdmin,
  hardDeleteAdmin,
  restoreAdmin,
};