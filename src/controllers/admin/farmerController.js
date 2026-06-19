const { Op } = require("sequelize");
const db = require("../../models");

const {
  Farmer,
  User,
  State,
  District,
  City,
  Category,
  Product,
  FarmerCrop,
  FarmerEarning,
  FarmerBankDetails,
  LandSegment,
} = db;

// ─────────────────────────────────────────────
// Helper: mask Aadhar number → XXXX-XXXX-1234
// ─────────────────────────────────────────────
const maskAadhar = (aadhar) => {
  if (!aadhar) return null;
  const cleaned = aadhar.replace(/\D/g, "");
  return `XXXX-XXXX-${cleaned.slice(-4)}`;
};

// ─────────────────────────────────────────────
// GET /admin/farmers
// List all farmers with pagination & filters
// ─────────────────────────────────────────────
exports.listFarmers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      state_id,
      district_id,
      is_active,
      sort_by = "created_at",
      order = "desc",
    } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    const sortableColumns = ["created_at", "total_earnings", "total_supplies"];
    const sortColumn = sortableColumns.includes(sort_by) ? sort_by : "created_at";
    const sortOrder = order.toLowerCase() === "asc" ? "ASC" : "DESC";

    // Farmer-level filters
    const farmerWhere = {};
    if (state_id)    farmerWhere.state_id    = parseInt(state_id);
    if (district_id) farmerWhere.district_id = parseInt(district_id);

    // User-level filters
    const userWhere = { role: "farmer" };
    if (is_active !== undefined) {
      userWhere.is_active = is_active === "true" || is_active === "1";
    }

    // Search: OR across farmer.full_name and user.mobile_number
    // We do this by using Sequelize's `where` on the literal joined column,
    // or more simply — filter by full_name on farmer side and use a subquery
    // approach via `required: true` with OR on user side.
    //
    // Cleanest approach: put full_name search on farmerWhere with Op.or,
    // and mobile_number search on userWhere with Op.or independently,
    // then use `required: false` on user include and handle at app level —
    // BUT that won't work cleanly.
    //
    // Best Sequelize approach: use literal OR across the join with where clause.
    if (search) {
      farmerWhere[Op.or] = [
        { full_name: { [Op.like]: `%${search}%` } },
        // Pull mobile_number match via a subquery on users table
        {
          user_id: {
            [Op.in]: db.sequelize.literal(
              `(SELECT user_id FROM users WHERE mobile_number LIKE '%${search.replace(/'/g, "''")}%' AND role = 'farmer')`
            ),
          },
        },
      ];
    }

    const { count, rows } = await Farmer.findAndCountAll({
      where: farmerWhere,
      include: [
        {
          model: User,
          as: "user",
          where: userWhere,
          attributes: ["user_id", "mobile_number", "email", "is_active", "is_verified", "last_login"],
          required: true,
        },
        { model: State,    as: "state_info",    attributes: ["state_id", "state_name"],       required: false },
        { model: District, as: "district_info", attributes: ["district_id", "district_name"], required: false },
        { model: City,     as: "city_info",     attributes: ["city_id", "city_name"],         required: false },
      ],
      order: [[sortColumn, sortOrder]],
      limit: limitNum,
      offset,
      distinct: true,
    });

    const totalPages = Math.ceil(count / limitNum);

    return res.status(200).json({
      success: true,
      message: "Farmers fetched successfully",
      data: {
        farmers: rows.map((f) => ({
          user_id:           f.user?.user_id,
          farmer_id:         f.farmer_id,
          full_name:         f.full_name,
          mobile_number:     f.user?.mobile_number,
          profile_photo_url: f.profile_photo_url,
          email:             f.user?.email,
          is_active:         f.user?.is_active,
          is_verified:       f.user?.is_verified,
          farm_name:         f.farm_name,
          location_address:  f.location_address,
          state:             f.state_info,
          district:          f.district_info,
          city:              f.city_info,
          latitude:          f.latitude,
          longitude:         f.longitude,
          total_land:        f.total_land,
          land_unit:         f.land_unit,
          allocated_land:    f.allocated_land,
          available_land:    f.available_land,
          land_photo_url:    f.land_photo_url,
          total_supplies:    f.total_supplies,
          total_earnings:    f.total_earnings,
          created_at:        f.created_at,
          last_login:        f.user?.last_login,
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
    console.error("listFarmers error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─────────────────────────────────────────────
// GET /admin/farmers/:farmer_id
// Get full farmer profile
// ─────────────────────────────────────────────
exports.getFarmerById = async (req, res) => {
  try {
    const { farmer_id } = req.params;

    const farmer = await Farmer.findByPk(farmer_id, {
      include: [
        {
          model: User,
          as: "user",
          attributes: [
            "user_id", "mobile_number", "email",
            "is_active", "is_verified", "profile_complete", "last_login",
          ],
        },
        { model: State, as: "state_info", attributes: ["state_id", "state_name", "state_code"], required: false },
        { model: District, as: "district_info", attributes: ["district_id", "district_name"], required: false },
        { model: City, as: "city_info", attributes: ["city_id", "city_name"], required: false },
      ],
    });

    if (!farmer) {
      return res.status(404).json({ success: false, message: "Farmer not found" });
    }

    const [totalSoldKg, totalEarnings] = await Promise.all([
      db.PickupDelivery.sum("actual_quantity_kg", {
        where: {
          farmer_id: farmer.farmer_id,
          status: "completed",
        },
      }),
      db.FarmerEarning.sum("net_amount", {
        where: {
          farmer_id: farmer.farmer_id,
        },
      }),
    ]);

    return res.status(200).json({
      success: true,
      message: "Farmer profile fetched successfully",
      data: {
        farmer_id: farmer.farmer_id,
        full_name: farmer.full_name,
        mobile_number: farmer.user?.mobile_number,
        email: farmer.user?.email,
        is_active: farmer.user?.is_active,
        is_verified: farmer.user?.is_verified,
        profile_complete: farmer.user?.profile_complete,
        aadhar_number: maskAadhar(farmer.aadhar_number),
        farm_name: farmer.farm_name,
        location_address: farmer.location_address,
        state: farmer.state_info,
        district: farmer.district_info,
        city: farmer.city_info,
        pincode: farmer.pincode,
        latitude: farmer.latitude,
        longitude: farmer.longitude,
        total_land: farmer.total_land,
        land_unit: farmer.land_unit,
        allocated_land: farmer.allocated_land,
        available_land: farmer.available_land,
        profile_photo_url: farmer.profile_photo_url,
        land_photo_url: farmer.land_photo_url,
        // total_supplies: farmer.total_supplies,
        total_supplies: totalSoldKg || 0,
        total_earnings: totalEarnings || 0,
        created_at: farmer.created_at,
        updated_at: farmer.updated_at,
        last_login: farmer.user?.last_login,
      },
    });
  } catch (error) {
    console.error("getFarmerById error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─────────────────────────────────────────────
// GET /admin/farmers/:farmer_id/crops
// List all crops for a farmer
// ─────────────────────────────────────────────
exports.getFarmerCrops = async (req, res) => {
  try {
    const { farmer_id } = req.params;

    const farmer = await Farmer.findByPk(farmer_id);
    if (!farmer) {
      return res.status(404).json({ success: false, message: "Farmer not found" });
    }

    const crops = await FarmerCrop.findAll({
      where: { farmer_id },
      include: [
        {
          model: LandSegment,
          as: "segment",
          attributes: [
            "segment_id",
            "crop_name",
            "area_value",
            "area_unit",
            "status",
          ],
          required: false,
        },
        {
          model: Product,
          as: "product",
          attributes: [
            "product_id",
            "product_name",
          ],
          include: [
            { model: Category, as: "category", attributes: ["category_id", "category_name"] },
          ],
          required: false,
        },        
      ],
      order: [["created_at", "DESC"]],
    });

    return res.status(200).json({
      success: true,
      message: "Farmer crops fetched successfully",
      data: { crops },
    });
  } catch (error) {
    console.error("getFarmerCrops error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─────────────────────────────────────────────
// GET /admin/farmers/:farmer_id/earnings
// Farmer earnings history with filters
// ─────────────────────────────────────────────
exports.getFarmerEarnings = async (req, res) => {
  try {
    const { farmer_id } = req.params;
    const { page = 1, limit = 20, payment_status, from_date, to_date } = req.query;

    const farmer = await Farmer.findByPk(farmer_id);
    if (!farmer) {
      return res.status(404).json({ success: false, message: "Farmer not found" });
    }

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    const where = { farmer_id };
    if (payment_status) where.payment_status = payment_status;
    if (from_date || to_date) {
      where.created_at = {};
      if (from_date) where.created_at[Op.gte] = new Date(from_date);
      if (to_date) {
        const end = new Date(to_date);
        end.setHours(23, 59, 59, 999);
        where.created_at[Op.lte] = end;
      }
    }

    const { count, rows } = await FarmerEarning.findAndCountAll({
      where,
      include: [
        {
          model: FarmerCrop,
          as: "crop",
          attributes: ["crop_id", "grade", "quantity_kg"],
          required: false,
        },
        {
          model: FarmerCrop,
          as: "crop",
          attributes: [
            "crop_id",
            "grade",
            "quantity_kg",
            "product_id"
          ],
          required: false,
          include: [
            {
              model: Product,
              as: "product",
              attributes: [
                "product_id",
                "product_name"
              ],
              required: false,
              include: [
                {
                  model: Category,
                  as: "category",
                  attributes: [
                    "category_id",
                    "category_name"
                  ]
                }
              ]
            }
          ]
        },
      ],
      order: [["created_at", "DESC"]],
      limit: limitNum,
      offset,
      distinct: true,
    });

    const totalPages = Math.ceil(count / limitNum);

    return res.status(200).json({
      success: true,
      message: "Farmer earnings fetched successfully",
      data: {
        earnings: rows,
        pagination: {
          total: count,
          page: pageNum,
          limit: limitNum,
          total_pages: totalPages,
        },
      },
    });
  } catch (error) {
    console.error("getFarmerEarnings error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─────────────────────────────────────────────
// GET /admin/farmers/:farmer_id/bank
// Farmer bank details
// ─────────────────────────────────────────────
exports.getFarmerBank = async (req, res) => {
  try {
    const { farmer_id } = req.params;

    const farmer = await Farmer.findByPk(farmer_id);
    if (!farmer) {
      return res.status(404).json({ success: false, message: "Farmer not found" });
    }

    const bankDetails = await FarmerBankDetails.findOne({ where: { farmer_id } });

    return res.status(200).json({
      success: true,
      message: "Farmer bank details fetched successfully",
      data: { bank_details: bankDetails || null },
    });
  } catch (error) {
    console.error("getFarmerBank error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─────────────────────────────────────────────
// GET /admin/farmers/:farmer_id/land
// Land partitions for a farmer
// ─────────────────────────────────────────────
exports.getFarmerLand = async (req, res) => {
  try {
    const { farmer_id } = req.params;

    const farmer = await Farmer.findByPk(farmer_id);
    if (!farmer) {
      return res.status(404).json({ success: false, message: "Farmer not found" });
    }

    const segments = await LandSegment.findAll({
      where: { farmer_id },
      order: [["created_at", "DESC"]],
    });

    return res.status(200).json({
      success: true,
      message: "Farmer land segments fetched successfully",
      data: { segments },
    });

  } catch (error) {
    console.error("getFarmerLand error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.getFarmerLand = async (req, res) => {
  try {
    const { farmer_id } = req.params;

    console.log("REQUEST farmer_id:", farmer_id);

    const farmer = await Farmer.findByPk(farmer_id);
    console.log("FARMER:", farmer?.toJSON());

    const segments = await LandSegment.findAll({
      where: { farmer_id },
      order: [["created_at", "DESC"]],
    });

    console.log("SEGMENTS COUNT:", segments.length);

    return res.status(200).json({
      success: true,
      data: { segments },
    });
  } catch (error) {
    console.error(error);
  }
};

// ─────────────────────────────────────────────
// PATCH /admin/farmers/:farmer_id
// Update farmer profile
// ─────────────────────────────────────────────
exports.updateFarmer = async (req, res) => {
  try {
    const { farmer_id } = req.params;

    const farmer = await Farmer.findByPk(farmer_id, {
      include: [{ model: User, as: "user" }],
    });

    if (!farmer) {
      return res.status(404).json({ success: false, message: "Farmer not found" });
    }

    const {
      // Farmer table fields
      full_name,
      farm_name,
      location_address,
      state_id,
      district_id,
      city_id,
      pincode,
      latitude,
      longitude,
      total_land,
      land_unit,
      // User table fields
      email,
      is_verified,
    } = req.body;

    // Update farmers table
    const farmerUpdates = {};
    if (full_name      !== undefined) farmerUpdates.full_name       = full_name;
    if (farm_name      !== undefined) farmerUpdates.farm_name       = farm_name;
    if (location_address !== undefined) farmerUpdates.location_address = location_address;
    if (state_id       !== undefined) farmerUpdates.state_id        = state_id;
    if (district_id    !== undefined) farmerUpdates.district_id     = district_id;
    if (city_id        !== undefined) farmerUpdates.city_id         = city_id;
    if (pincode        !== undefined) farmerUpdates.pincode         = pincode;
    if (latitude       !== undefined) farmerUpdates.latitude        = latitude;
    if (longitude      !== undefined) farmerUpdates.longitude       = longitude;
    if (total_land     !== undefined) farmerUpdates.total_land      = total_land;
    if (land_unit      !== undefined) farmerUpdates.land_unit       = land_unit;

    // Update users table
    const userUpdates = {};
    if (email       !== undefined) userUpdates.email       = email;
    if (is_verified !== undefined) userUpdates.is_verified = is_verified;

    if (Object.keys(farmerUpdates).length > 0) {
      await Farmer.update(farmerUpdates, { where: { farmer_id } });
    }

    if (Object.keys(userUpdates).length > 0) {
      await User.update(userUpdates, { where: { user_id: farmer.user_id } });
    }

    return res.status(200).json({
      success: true,
      message: "Farmer updated successfully",
    });
  } catch (error) {
    console.error("updateFarmer error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─────────────────────────────────────────────
// PATCH /admin/farmers/:farmer_id/activate
// Set is_active = true on users table
// ─────────────────────────────────────────────
exports.activateFarmer = async (req, res) => {
  try {
    const { farmer_id } = req.params;

    const farmer = await Farmer.findByPk(farmer_id, {
      include: [{ model: User, as: "user" }],
    });

    if (!farmer) {
      return res.status(404).json({ success: false, message: "Farmer not found" });
    }

    if (farmer.user.is_active) {
      return res.status(409).json({ success: false, message: "Farmer is already active" });
    }

    await User.update({ is_active: true }, { where: { user_id: farmer.user_id } });

    return res.status(200).json({
      success: true,
      message: "Farmer activated successfully",
    });
  } catch (error) {
    console.error("activateFarmer error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─────────────────────────────────────────────
// PATCH /admin/farmers/:farmer_id/deactivate
// Set is_active = false on users table
// ─────────────────────────────────────────────
exports.deactivateFarmer = async (req, res) => {
  try {
    const { farmer_id } = req.params;

    const farmer = await Farmer.findByPk(farmer_id, {
      include: [{ model: User, as: "user" }],
    });

    if (!farmer) {
      return res.status(404).json({ success: false, message: "Farmer not found" });
    }

    if (!farmer.user.is_active) {
      return res.status(409).json({ success: false, message: "Farmer is already inactive" });
    }

    await User.update({ is_active: false }, { where: { user_id: farmer.user_id } });

    return res.status(200).json({
      success: true,
      message: "Farmer deactivated successfully",
    });
  } catch (error) {
    console.error("deactivateFarmer error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─────────────────────────────────────────────
// DELETE /admin/farmers/:farmer_id
// Hard delete farmer + cascade user record
// ─────────────────────────────────────────────
exports.deleteFarmer = async (req, res) => {
  try {
    const { farmer_id } = req.params;

    const farmer = await Farmer.findByPk(farmer_id, {
      include: [{ model: User, as: "user" }],
    });

    if (!farmer) {
      return res.status(404).json({ success: false, message: "Farmer not found" });
    }

    const userId = farmer.user_id;

    // Delete farmer first (child), then user (parent)
    await farmer.destroy();
    await User.destroy({ where: { user_id: userId } });

    return res.status(200).json({
      success: true,
      message: "Farmer deleted successfully",
    });
  } catch (error) {
    console.error("deleteFarmer error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};