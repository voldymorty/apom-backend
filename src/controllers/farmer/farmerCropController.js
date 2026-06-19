const db = require("../../models");
const { Op } = require("sequelize");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// ─── Multer for crop photos ────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const username = req.user?.mobile_number || "unknown";
    const folder = path.join(__dirname, "../../uploads", username, "crops");
    if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
    cb(null, folder);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}_${file.fieldname}${ext}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/jpg", "image/webp"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only image files are allowed"), false);
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

// Upload up to 3 crop photos
exports.uploadCropPhotos = upload.array("crop_photos", 3);

// ─── GET /farmer-crops/categories ─────────────────────────────
// Returns categories with their products for Flutter dropdowns
exports.getCategoriesWithProducts = async (req, res) => {
  try {
    const categories = await db.Category.findAll({
      where: { is_active: true },
      attributes: ["category_id", "category_name", "category_code", "icon_url", "image_url"],
      include: [
        {
          model: db.Product,
          as: "products",
          where: { is_active: true },
          attributes: ["product_id", "product_name", "product_code", "unit", "image_url"],
          required: false,
        },
      ],
      order: [["display_order", "ASC"], [{ model: db.Product, as: "products" }, "product_name", "ASC"]],
    });

    return res.json({ success: true, data: categories });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── GET /farmer-crops ─────────────────────────────────────────
exports.getMyCrops = async (req, res) => {
  try {
    const farmer = await db.Farmer.findOne({ where: { user_id: req.user.user_id } });
    if (!farmer) return res.status(404).json({ success: false, message: "Farmer profile not found" });

    const { status } = req.query;
    const where = { farmer_id: farmer.farmer_id };
    if (status) where.status = status;

    const crops = await db.FarmerCrop.findAll({
      where,
      include: [
        {
          model: db.Product,
          as: "product",
          attributes: ["product_id", "product_name", "unit", "image_url"],
          include: [{ model: db.Category, as: "category", attributes: ["category_id", "category_name"] }],
        },
      ],
      order: [["created_at", "DESC"]],
    });

    return res.json({ success: true, total: crops.length, data: crops });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// // ─── GET /farmer-crops/all  (admin) ───────────────────────────
// exports.getAllCrops = async (req, res) => {
//   try {
//     const { page = 1, limit = 20, status, farmer_id, product_id } = req.query;
//     const where = {};
//     if (status) where.status = status;
//     if (farmer_id) where.farmer_id = farmer_id;
//     if (product_id) where.product_id = product_id;

//     const { count, rows } = await db.FarmerCrop.findAndCountAll({
//       where,
//       include: [
//         { model: db.Farmer, as: "farmer", attributes: ["full_name"] },
//         {
//           model: db.Product,
//           as: "product",
//           attributes: ["product_id", "product_name", "unit"],
//           include: [{ model: db.Category, as: "category", attributes: ["category_id", "category_name"] }],
//         },
//       ],
//       limit: parseInt(limit),
//       offset: (page - 1) * limit,
//       order: [["created_at", "DESC"]],
//     });

//     return res.json({
//       success: true,
//       data: rows,
//       total: count,
//       page: parseInt(page),
//       limit: parseInt(limit),
//       totalPages: Math.ceil(count / limit),
//     });
//   } catch (err) {
//     return res.status(500).json({ success: false, message: err.message });
//   }
// };

// ─── GET /farmer-crops/:crop_id ────────────────────────────────
exports.getCropById = async (req, res) => {
  try {
    const crop = await db.FarmerCrop.findByPk(req.params.crop_id, {
      include: [
        {
          model: db.Product,
          as: "product",
          include: [{ model: db.Category, as: "category" }],
        },
        { model: db.Farmer, as: "farmer", attributes: ["farmer_id", "full_name"] },
      ],
    });
    if (!crop) return res.status(404).json({ success: false, message: "Crop not found" });
    return res.json({ success: true, data: crop });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── POST /farmer-crops ────────────────────────────────────────
// multipart/form-data — crop_photos (up to 3), product_id, quantity_kg,
// expected_price_per_kg, grade, available_date, remarks
exports.addCrop = async (req, res) => {
  const t = await db.sequelize.transaction();
  try {
    const farmer = await db.Farmer.findOne({ 
      where: { user_id: req.user.user_id },
      transaction: t
    });
    if (!farmer) {
      await t.rollback();
      return res.status(404).json({ success: false, message: "Farmer profile not found" });
    }

    const {
      product_id,
      quantity_kg,
      expected_price_per_kg,
      grade,
      harvest_date,
      remarks,
    } = req.body;

    // Validate grade
    const allowedGrades = ["A", "B", "C"];
    if (grade && !allowedGrades.includes(grade)) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: `Invalid grade. Allowed values: ${allowedGrades.join(", ")}`,
      });
    }

    // Validate product exists
    const product = await db.Product.findByPk(product_id, { transaction: t });
    if (!product) {
      await t.rollback();
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    // Build photo URLs (up to 3)
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const username = req.user.mobile_number;
    let crop_photo_urls = [];

    if (req.files && req.files.length > 0) {
      crop_photo_urls = req.files.map(
        (f) => `${baseUrl}/uploads/${username}/crops/${f.filename}`
      );
    }

    const crop = await db.FarmerCrop.create({
      farmer_id:             farmer.farmer_id,
      segment_id:            req.body.segment_id || null,
      product_id,
      quantity_kg,
      expected_price_per_kg,
      grade:                 grade || "A",
      harvest_date:          harvest_date || null,
      remarks:               remarks || null,
      status:                "available",
      is_ready:              true,
      crop_photo_url:        crop_photo_urls.length > 0 ? JSON.stringify(crop_photo_urls) : null,
    }, { transaction: t });

    // Generate delivery_number (PKP-YYYYMMDD-XXXX)
    const today = new Date();
    const datePart = today.toISOString().slice(0, 10).replace(/-/g, "");

    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay   = new Date(today.setHours(23, 59, 59, 999));

    const count = await db.PickupDelivery.count({
      where: {
        delivery_type: "pickup",
        created_at: { [Op.between]: [startOfDay, endOfDay] },
      },
      transaction: t,
    });

    const sequence = String(count + 1).padStart(4, "0");
    const delivery_number = `PKP-${datePart}-${sequence}`;

    // Create matching unassigned PickupDelivery record
    const pickupTask = await db.PickupDelivery.create({
      delivery_number,
      delivery_type: "pickup",
      farmer_id: farmer.farmer_id,
      crop_id: crop.crop_id,
      delivery_person_id: null, // unassigned
      pickup_address: farmer.location_address || "N/A",
      pickup_contact_name: farmer.full_name,
      pickup_contact_number: req.user.mobile_number,
      pickup_latitude: farmer.latitude || null,
      pickup_longitude: farmer.longitude || null,
      scheduled_date: harvest_date || null,
      expected_quantity_kg: quantity_kg,
      delivery_notes: remarks || null,
      status: "assigned", // Default active task status in schema
    }, { transaction: t });

    // Log status history
    await db.DeliveryStatusHistory.create({
      delivery_id: pickupTask.delivery_id,
      old_status: null,
      new_status: "assigned",
      changed_by: req.user.user_id,
      remarks: "Pickup request submitted by farmer",
    }, { transaction: t });

    await t.commit();

    return res.status(201).json({
      success: true,
      message: "Crop submitted and unassigned logistics pickup task created successfully",
      data: {
        ...crop.toJSON(),
        crop_photo_urls,
        pickup_task: {
          delivery_id: pickupTask.delivery_id,
          delivery_number: pickupTask.delivery_number,
          status: pickupTask.status,
        }
      },
    });
  } catch (err) {
    await t.rollback();
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── PUT /farmer-crops/:crop_id ────────────────────────────────
exports.updateCrop = async (req, res) => {
  try {
    const farmer = await db.Farmer.findOne({ where: { user_id: req.user.user_id } });
    const crop = await db.FarmerCrop.findOne({
      where: { crop_id: req.params.crop_id, farmer_id: farmer?.farmer_id },
    });
    if (!crop) return res.status(404).json({ success: false, message: "Crop not found" });

    const allowedGrades = ["A", "B", "C"];
    if (req.body.grade && !allowedGrades.includes(req.body.grade)) {
      return res.status(400).json({
        success: false,
        message: `Invalid grade. Allowed values: ${allowedGrades.join(", ")}`,
      });
    }

    // Handle new photos if uploaded
    const baseUrl = `${req.protocol}://${req.get("host")}`;
    const username = req.user.mobile_number;
    let crop_photo_urls = undefined;

    if (req.files && req.files.length > 0) {
      const newUrls = req.files.map(
        (f) => `${baseUrl}/uploads/${username}/crops/${f.filename}`
      );
      // Merge with existing or replace
      const existing = crop.crop_photo_url ? JSON.parse(crop.crop_photo_url) : [];
      const merged = [...existing, ...newUrls].slice(0, 3); // max 3
      crop_photo_urls = JSON.stringify(merged);
    }

    await crop.update({
      product_id:            req.body.product_id            || crop.product_id,
      quantity_kg:           req.body.quantity_kg           || crop.quantity_kg,
      expected_price_per_kg: req.body.expected_price_per_kg || crop.expected_price_per_kg,
      grade:                 req.body.grade                 || crop.grade,
      harvest_date:          req.body.harvest_date          || crop.harvest_date,
      remarks:               req.body.remarks               !== undefined ? req.body.remarks : crop.remarks,
      crop_photo_url:        crop_photo_urls                || crop.crop_photo_url,
    });

    return res.json({ success: true, message: "Crop updated", data: crop });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── DELETE /farmer-crops/:crop_id ────────────────────────────
exports.deleteCrop = async (req, res) => {
  try {
    const farmer = await db.Farmer.findOne({ where: { user_id: req.user.user_id } });
    const crop = await db.FarmerCrop.findOne({
      where: { crop_id: req.params.crop_id, farmer_id: farmer?.farmer_id },
    });
    if (!crop) return res.status(404).json({ success: false, message: "Crop not found" });
    if (crop.status !== "available") {
      return res.status(400).json({
        success: false,
        message: "Cannot delete a crop that is already assigned or picked up",
      });
    }
    await crop.destroy();
    return res.json({ success: true, message: "Crop deleted" });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
