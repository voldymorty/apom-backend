const db = require("../../models");
const { Op } = require("sequelize");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// ─── Multer for Profile Photo ────────────────────────────────────────────────
const profileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folder = path.join(
      __dirname,
      "../../uploads",
      req.user.mobile_number,
      "profile"
    );
    if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
    cb(null, folder);
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

const profileUpload = multer({
  storage: profileStorage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, // 5MB
});

exports.uploadProfilePhoto = profileUpload.fields([
  { name: "profile_photo", maxCount: 1 },
]);

// ─── Helper ──────────────────────────────────────────────────────────────────
const getDeliveryPerson = (user_id) =>
  db.DeliveryPersonnel.findOne({ where: { user_id } });

// ─── GET /delivery/profile ───────────────────────────────────────────────────
exports.getProfile = async (req, res) => {
  try {
    const dp = await db.DeliveryPersonnel.findOne({
      where: { user_id: req.user.user_id },
      include: [
        {
          model: db.User,
          as: "user",
          attributes: ["mobile_number", "email", "is_active"],
        },
      ],
    });
    if (!dp)
      return res
        .status(404)
        .json({ success: false, message: "Delivery profile not found" });

    return res.json({ success: true, data: dp });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── PUT /delivery/profile ───────────────────────────────────────────────────
// Body (multipart/form-data): full_name?, vehicle_type?, vehicle_number?,
//   license_number?, license_expiry_date?
// File: profile_photo (optional)
exports.updateProfile = async (req, res) => {
  try {
    const dp = await getDeliveryPerson(req.user.user_id);
    if (!dp)
      return res
        .status(404)
        .json({ success: false, message: "Delivery profile not found" });

    const allowedFields = [
      "full_name",
      "vehicle_type",
      "vehicle_number",
      "license_number",
      "license_expiry_date",
    ];

    const updateData = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) updateData[field] = req.body[field];
    });

    if (req.files?.profile_photo?.[0]) {
      const file = req.files.profile_photo[0];
      // Delete old photo if exists
      if (dp.profile_photo_url) {
        const oldPath = path.join(__dirname, "../../", dp.profile_photo_url);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      updateData.profile_photo_url = `/uploads/${req.user.mobile_number}/profile/${file.filename}`;
    }

    await dp.update(updateData);
    return res.json({
      success: true,
      message: "Profile updated successfully",
      data:    dp,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── GET /delivery/history ────────────────────────────────────────────────────
// Query: page, limit, from_date, to_date, type (pickup|delivery)
// Returns completed / failed / cancelled task history
exports.getTaskHistory = async (req, res) => {
  try {
    const dp = await getDeliveryPerson(req.user.user_id);
    if (!dp)
      return res
        .status(404)
        .json({ success: false, message: "Delivery profile not found" });

    const { page = 1, limit = 20, from_date, to_date, type } = req.query;

    const where = {
      delivery_person_id: dp.delivery_person_id,
      status: { [Op.in]: ["completed", "failed", "cancelled"] },
    };

    if (type) where.delivery_type = type;

    if (from_date || to_date) {
      where.scheduled_date = {};
      if (from_date) where.scheduled_date[Op.gte] = from_date;
      if (to_date)   where.scheduled_date[Op.lte] = to_date;
    }

    const { count, rows } = await db.PickupDelivery.findAndCountAll({
      where,
      include: [
        {
          model: db.Farmer,
          as: "farmer",
          attributes: ["full_name"],
          include: [{ model: db.User, as: "user", attributes: ["mobile_number"] }],
        },
        {
          model: db.Vendor,
          as: "vendor",
          attributes: ["shop_name", "owner_name"],
          include: [{ model: db.User, as: "user", attributes: ["mobile_number"] }],
        },
        {
          model: db.FarmerCrop,
          as: "crop",
          include: [
            { model: db.Product, as: "product", attributes: ["product_name"] },
          ],
        },
        {
          model: db.Order,
          as: "order",
          attributes: ["order_number", "order_status"],
        },
      ],
      limit:  parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      order:  [["completed_at", "DESC"]],
    });

    // Per-type counts for the history screen summary chips
    const [totalCompleted, totalFailed, totalCancelled] = await Promise.all([
      db.PickupDelivery.count({
        where: { delivery_person_id: dp.delivery_person_id, status: "completed" },
      }),
      db.PickupDelivery.count({
        where: { delivery_person_id: dp.delivery_person_id, status: "failed" },
      }),
      db.PickupDelivery.count({
        where: { delivery_person_id: dp.delivery_person_id, status: "cancelled" },
      }),
    ]);

    const mappedRows = [];
    for (const row of rows) {
      const taskJson = row.toJSON();
      if (taskJson.delivery_type === "delivery" && taskJson.order_id) {
        const orderItems = await db.OrderItem.findAll({
          where: { order_id: taskJson.order_id },
          include: [{ model: db.Product, as: "product" }],
        });
        taskJson.crop = {
          crop_id: 0,
          quantity_kg: taskJson.expected_quantity_kg,
          product: {
            product_name: orderItems
              .map((item) => `${item.product?.product_name || "Product"} (${item.quantity_kg}kg)`)
              .join(", "),
          },
        };
      }
      mappedRows.push(taskJson);
    }

    return res.json({
      success:    true,
      data:       mappedRows,
      total:      count,
      page:       parseInt(page),
      limit:      parseInt(limit),
      totalPages: Math.ceil(count / parseInt(limit)),
      summary: {
        total_assigned:   dp.total_deliveries,
        total_completed:  totalCompleted,
        total_failed:     totalFailed,
        total_cancelled:  totalCancelled,
        rating:           dp.rating,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── GET /delivery/dashboard ──────────────────────────────────────────────────
// Quick stats for the home/dashboard screen
exports.getDashboard = async (req, res) => {
  try {
    const dp = await db.DeliveryPersonnel.findOne({
      where: { user_id: req.user.user_id },
      include: [
        {
          model: db.User,
          as: "user",
          attributes: ["mobile_number", "email", "is_active"],
        },
      ],
    });
    if (!dp)
      return res
        .status(404)
        .json({ success: false, message: "Delivery profile not found" });

    const today = new Date().toISOString().split("T")[0];

    const [
      todayTotal,
      todayCompleted,
      todayPending,
      todayFailed,
      activeTask,
    ] = await Promise.all([
      db.PickupDelivery.count({
        where: { delivery_person_id: dp.delivery_person_id, scheduled_date: today },
      }),
      db.PickupDelivery.count({
        where: {
          delivery_person_id: dp.delivery_person_id,
          scheduled_date:     today,
          status:             "completed",
        },
      }),
      db.PickupDelivery.count({
        where: {
          delivery_person_id: dp.delivery_person_id,
          scheduled_date:     today,
          status:             { [Op.in]: ["assigned", "accepted", "in_transit", "reached"] },
        },
      }),
      db.PickupDelivery.count({
        where: {
          delivery_person_id: dp.delivery_person_id,
          scheduled_date:     today,
          status:             "failed",
        },
      }),
      // The one task currently in progress
      db.PickupDelivery.findOne({
        where: {
          delivery_person_id: dp.delivery_person_id,
          status:             { [Op.in]: ["in_transit", "reached"] },
        },
        include: [
          { model: db.Farmer, as: "farmer", attributes: ["full_name"] },
          { model: db.Vendor, as: "vendor", attributes: ["shop_name", "owner_name"] },
        ],
        order: [["started_at", "DESC"]],
      }),
    ]);

    return res.json({
      success: true,
      data: {
        driver: {
          full_name:            dp.full_name,
          profile_photo_url:    dp.profile_photo_url,
          vehicle_type:         dp.vehicle_type,
          vehicle_number:       dp.vehicle_number,
          is_available:         dp.is_available,
          rating:               dp.rating,
          all_time_completed:   dp.completed_deliveries,
          all_time_assigned:    dp.total_deliveries,
        },
        today: {
          total:     todayTotal,
          completed: todayCompleted,
          pending:   todayPending,
          failed:    todayFailed,
        },
        active_task: activeTask,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};