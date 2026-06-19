const { Op } = require("sequelize");
const bcrypt = require("bcryptjs");
const db = require("../../models");

const { DeliveryPersonnel, User } = db;

// ─────────────────────────────────────────────
// POST /admin/delivery-personnel
// Create new delivery personnel account
// ─────────────────────────────────────────────
exports.createDeliveryPersonnel = async (req, res) => {
  try {
    const {
      // User fields
      mobile_number,
      password,
      email,
      // Delivery personnel fields
      full_name,
      vehicle_type,
      vehicle_number,
      license_number,
      license_expiry_date,
    } = req.body;

    // Required field validation
    if (!mobile_number || !password || !full_name || !vehicle_type || !vehicle_number) {
      return res.status(400).json({
        success: false,
        message: "mobile_number, password, full_name, vehicle_type and vehicle_number are required",
      });
    }

    // Check duplicate mobile_number
    const existingUser = await User.findOne({ where: { mobile_number } });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "A user with this mobile number already exists",
      });
    }

    // Check duplicate vehicle_number
    const existingVehicle = await DeliveryPersonnel.findOne({ where: { vehicle_number } });
    if (existingVehicle) {
      return res.status(409).json({
        success: false,
        message: "A delivery personnel with this vehicle number already exists",
      });
    }

    // Check duplicate license_number (only if provided)
    if (license_number) {
      const existingLicense = await DeliveryPersonnel.findOne({ where: { license_number } });
      if (existingLicense) {
        return res.status(409).json({
          success: false,
          message: "A delivery personnel with this license number already exists",
        });
      }
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Create user record
    const newUser = await User.create({
      mobile_number,
      password_hash,
      email: email || null,
      role: "delivery",
      is_active: true,
      is_verified: false,
      profile_complete: false,
    });

    // Create delivery personnel record
    const newPersonnel = await DeliveryPersonnel.create({
      user_id: newUser.user_id,
      full_name,
      vehicle_type,
      vehicle_number,
      license_number: license_number || null,
      license_expiry_date: license_expiry_date || null,
      is_available: true,
      total_deliveries: 0,
      completed_deliveries: 0,
      rating: 0.00,
    });

    return res.status(201).json({
      success: true,
      message: "Delivery personnel account created successfully",
      data: {
        delivery_person_id: newPersonnel.delivery_person_id,
        user_id: newUser.user_id,
        mobile_number: newUser.mobile_number,
        full_name: newPersonnel.full_name,
        vehicle_type: newPersonnel.vehicle_type,
        vehicle_number: newPersonnel.vehicle_number,
        license_number: newPersonnel.license_number,
        license_expiry_date: newPersonnel.license_expiry_date,
        is_active: newUser.is_active,
        created_at: newPersonnel.created_at,
      },
    });
  } catch (error) {
    console.error("createDeliveryPersonnel error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─────────────────────────────────────────────
// GET /admin/delivery-personnel
// List all with pagination & filters
// ─────────────────────────────────────────────
exports.listDeliveryPersonnel = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      is_available,
      vehicle_type,
      is_active,
      sort_by = "created_at",
      order = "desc",
    } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    const sortableColumns = ["created_at", "total_deliveries", "rating"];
    const sortColumn = sortableColumns.includes(sort_by) ? sort_by : "created_at";
    const sortOrder = order.toLowerCase() === "asc" ? "ASC" : "DESC";

    // Build personnel-level WHERE
    const personnelWhere = {};
    if (vehicle_type)  personnelWhere.vehicle_type  = vehicle_type;
    if (is_available !== undefined) {
      personnelWhere.is_available = is_available === "true" || is_available === "1";
    }

    // Search: full_name OR mobile_number via subquery
    if (search) {
      personnelWhere[Op.or] = [
        { full_name: { [Op.like]: `%${search}%` } },
        {
          user_id: {
            [Op.in]: db.sequelize.literal(
              `(SELECT user_id FROM users WHERE mobile_number LIKE '%${search.replace(/'/g, "''")}%' AND role = 'delivery')`
            ),
          },
        },
      ];
    }

    // Build user-level WHERE
    const userWhere = { role: "delivery" };
    if (is_active !== undefined) {
      userWhere.is_active = is_active === "true" || is_active === "1";
    }

    const { count, rows } = await DeliveryPersonnel.findAndCountAll({
      where: personnelWhere,
      include: [
        {
          model: User,
          as: "user",
          where: userWhere,
          attributes: ["user_id", "mobile_number", "email", "is_active", "is_verified", "last_login"],
          required: true,
        },
      ],
      order: [[sortColumn, sortOrder]],
      limit: limitNum,
      offset,
      distinct: true,
    });

    const totalPages = Math.ceil(count / limitNum);

    return res.status(200).json({
      success: true,
      message: "Delivery personnel fetched successfully",
      data: {
        personnel: rows.map((p) => ({
          user_id:              p.user?.user_id,
          delivery_person_id:   p.delivery_person_id,
          full_name:            p.full_name,
          mobile_number:        p.user?.mobile_number,
          email:                p.user?.email,
          is_active:            p.user?.is_active,
          is_verified:          p.user?.is_verified,
          profile_photo_url:    p.profile_photo_url,
          vehicle_type:         p.vehicle_type,
          vehicle_number:       p.vehicle_number,
          license_number:       p.license_number,
          license_expiry_date:  p.license_expiry_date,
          is_available:         p.is_available,
          total_deliveries:     p.total_deliveries,
          completed_deliveries: p.completed_deliveries,
          rating:               p.rating,
          created_at:           p.created_at,
          last_login:           p.user?.last_login,
        })),
        pagination: {
          total:       count,
          page:        pageNum,
          limit:       limitNum,
          total_pages: totalPages,
        },
      },
    });
  } catch (error) {
    console.error("listDeliveryPersonnel error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─────────────────────────────────────────────
// GET /admin/delivery-personnel/:delivery_person_id
// Get full profile
// ─────────────────────────────────────────────
exports.getDeliveryPersonnelById = async (req, res) => {
  try {
    const { delivery_person_id } = req.params;

    const personnel = await DeliveryPersonnel.findByPk(delivery_person_id, {
      include: [
        {
          model: User,
          as: "user",
          attributes: [
            "user_id", "mobile_number", "email",
            "is_active", "is_verified", "profile_complete", "last_login",
          ],
        },
      ],
    });

    if (!personnel) {
      return res.status(404).json({ success: false, message: "Delivery personnel not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Delivery personnel profile fetched successfully",
      data: {
        delivery_person_id:   personnel.delivery_person_id,
        full_name:            personnel.full_name,
        mobile_number:        personnel.user?.mobile_number,
        email:                personnel.user?.email,
        is_active:            personnel.user?.is_active,
        is_verified:          personnel.user?.is_verified,
        profile_complete:     personnel.user?.profile_complete,
        profile_photo_url:    personnel.profile_photo_url,
        vehicle_type:         personnel.vehicle_type,
        vehicle_number:       personnel.vehicle_number,
        license_number:       personnel.license_number,
        license_expiry_date:  personnel.license_expiry_date,
        is_available:         personnel.is_available,
        current_latitude:     personnel.current_latitude,
        current_longitude:    personnel.current_longitude,
        last_location_update: personnel.last_location_update,
        total_deliveries:     personnel.total_deliveries,
        completed_deliveries: personnel.completed_deliveries,
        rating:               personnel.rating,
        created_at:           personnel.created_at,
        updated_at:           personnel.updated_at,
        last_login:           personnel.user?.last_login,
      },
    });
  } catch (error) {
    console.error("getDeliveryPersonnelById error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─────────────────────────────────────────────
// PATCH /admin/delivery-personnel/:delivery_person_id
// Update delivery personnel
// ─────────────────────────────────────────────
exports.updateDeliveryPersonnel = async (req, res) => {
  try {
    const { delivery_person_id } = req.params;

    const personnel = await DeliveryPersonnel.findByPk(delivery_person_id, {
      include: [{ model: User, as: "user" }],
    });

    if (!personnel) {
      return res.status(404).json({ success: false, message: "Delivery personnel not found" });
    }

    const {
      // Personnel fields
      full_name,
      vehicle_type,
      vehicle_number,
      license_number,
      license_expiry_date,
      is_available,
      // User fields
      mobile_number,
      email,
      is_verified,
    } = req.body;

    // Check vehicle_number uniqueness if being changed
    if (vehicle_number && vehicle_number !== personnel.vehicle_number) {
      const existing = await DeliveryPersonnel.findOne({ where: { vehicle_number } });
      if (existing) {
        return res.status(409).json({ success: false, message: "Vehicle number already in use" });
      }
    }

    // Check license_number uniqueness if being changed
    if (license_number && license_number !== personnel.license_number) {
      const existing = await DeliveryPersonnel.findOne({ where: { license_number } });
      if (existing) {
        return res.status(409).json({ success: false, message: "License number already in use" });
      }
    }

    // Check mobile_number uniqueness if being changed
    if (mobile_number && mobile_number !== personnel.user?.mobile_number) {
      const existing = await User.findOne({ where: { mobile_number } });
      if (existing) {
        return res.status(409).json({ success: false, message: "Mobile number already in use" });
      }
    }

    // Build personnel updates
    const personnelUpdates = {};
    if (full_name           !== undefined) personnelUpdates.full_name           = full_name;
    if (vehicle_type        !== undefined) personnelUpdates.vehicle_type        = vehicle_type;
    if (vehicle_number      !== undefined) personnelUpdates.vehicle_number      = vehicle_number;
    if (license_number      !== undefined) personnelUpdates.license_number      = license_number;
    if (license_expiry_date !== undefined) personnelUpdates.license_expiry_date = license_expiry_date;
    if (is_available        !== undefined) personnelUpdates.is_available        = is_available;

    // Build user updates
    const userUpdates = {};
    if (mobile_number !== undefined) userUpdates.mobile_number = mobile_number;
    if (email         !== undefined) userUpdates.email         = email;
    if (is_verified   !== undefined) userUpdates.is_verified   = is_verified;

    if (Object.keys(personnelUpdates).length === 0 && Object.keys(userUpdates).length === 0) {
      return res.status(400).json({ success: false, message: "No valid fields provided to update" });
    }

    if (Object.keys(personnelUpdates).length > 0) {
      await DeliveryPersonnel.update(personnelUpdates, { where: { delivery_person_id } });
    }

    if (Object.keys(userUpdates).length > 0) {
      await User.update(userUpdates, { where: { user_id: personnel.user_id } });
    }

    return res.status(200).json({
      success: true,
      message: "Delivery personnel updated successfully",
    });
  } catch (error) {
    console.error("updateDeliveryPersonnel error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─────────────────────────────────────────────
// PATCH /admin/delivery-personnel/:delivery_person_id/activate
// Set is_active = true on users table
// ─────────────────────────────────────────────
exports.activateDeliveryPersonnel = async (req, res) => {
  try {
    const { delivery_person_id } = req.params;

    const personnel = await DeliveryPersonnel.findByPk(delivery_person_id, {
      include: [{ model: User, as: "user" }],
    });

    if (!personnel) {
      return res.status(404).json({ success: false, message: "Delivery personnel not found" });
    }

    if (personnel.user?.is_active) {
      return res.status(409).json({ success: false, message: "Delivery personnel is already active" });
    }

    await User.update({ is_active: true }, { where: { user_id: personnel.user_id } });

    return res.status(200).json({
      success: true,
      message: "Delivery personnel activated successfully",
    });
  } catch (error) {
    console.error("activateDeliveryPersonnel error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─────────────────────────────────────────────
// PATCH /admin/delivery-personnel/:delivery_person_id/deactivate
// Set is_active = false on users table
// ─────────────────────────────────────────────
exports.deactivateDeliveryPersonnel = async (req, res) => {
  try {
    const { delivery_person_id } = req.params;

    const personnel = await DeliveryPersonnel.findByPk(delivery_person_id, {
      include: [{ model: User, as: "user" }],
    });

    if (!personnel) {
      return res.status(404).json({ success: false, message: "Delivery personnel not found" });
    }

    if (!personnel.user?.is_active) {
      return res.status(409).json({ success: false, message: "Delivery personnel is already inactive" });
    }

    await User.update({ is_active: false }, { where: { user_id: personnel.user_id } });

    return res.status(200).json({
      success: true,
      message: "Delivery personnel deactivated successfully",
    });
  } catch (error) {
    console.error("deactivateDeliveryPersonnel error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─────────────────────────────────────────────
// DELETE /admin/delivery-personnel/:delivery_person_id
// Hard delete personnel + cascade user record
// ─────────────────────────────────────────────
exports.deleteDeliveryPersonnel = async (req, res) => {
  try {
    const { delivery_person_id } = req.params;

    const personnel = await DeliveryPersonnel.findByPk(delivery_person_id, {
      include: [{ model: User, as: "user" }],
    });

    if (!personnel) {
      return res.status(404).json({ success: false, message: "Delivery personnel not found" });
    }

    const userId = personnel.user_id;

    // Delete child first, then parent
    await personnel.destroy();
    await User.destroy({ where: { user_id: userId } });

    return res.status(200).json({
      success: true,
      message: "Delivery personnel deleted successfully",
    });
  } catch (error) {
    console.error("deleteDeliveryPersonnel error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};