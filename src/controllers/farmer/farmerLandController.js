const db = require("../../models");
const { Op } = require("sequelize");

const allowedStatus = ["active", "fallow", "harvested"];

// ─── GET /farmer-land?status=active ───────────────────────────
exports.getAll = async (req, res) => {
  try {
    const farmer = await db.Farmer.findOne({ where: { user_id: req.user.user_id } });
    if (!farmer) return res.status(404).json({ success: false, message: "Farmer not found" });

    const where = { farmer_id: farmer.farmer_id };

    if (req.query.status) {
      if (!allowedStatus.includes(req.query.status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status. Allowed values: ${allowedStatus.join(", ")}`,
        });
      }
      where.status = req.query.status;
    }

    const [segments, activeCount, fallowCount, harvestedCount] = await Promise.all([
      db.LandSegment.findAll({ where, order: [["created_at", "DESC"]] }),
      db.LandSegment.count({ where: { farmer_id: farmer.farmer_id, status: "active" } }),
      db.LandSegment.count({ where: { farmer_id: farmer.farmer_id, status: "fallow" } }),
      db.LandSegment.count({ where: { farmer_id: farmer.farmer_id, status: "harvested" } }),
    ]);

    return res.json({
      success: true,
      summary: {
        total_land:      parseFloat(farmer.total_land),
        land_unit:       farmer.land_unit,
        allocated_land:  parseFloat(farmer.allocated_land) || 0,
        available_land:  parseFloat(farmer.available_land) || 0,
        active_count:    activeCount,
        fallow_count:    fallowCount,
        harvested_count: harvestedCount,
        total_segments:  activeCount + fallowCount + harvestedCount,
      },
      total: segments.length,
      data:  segments,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── POST /farmer-land ─────────────────────────────────────────
exports.create = async (req, res) => {
  try {
    const farmer = await db.Farmer.findOne({ where: { user_id: req.user.user_id } });
    if (!farmer) return res.status(404).json({ success: false, message: "Farmer not found" });

    const { crop_name, area_value, area_unit, plantation_date, harvesting_date, status } = req.body;

    if (status && !allowedStatus.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Allowed values: ${allowedStatus.join(", ")}`,
      });
    }

    const segment = await db.LandSegment.create({
      farmer_id:       farmer.farmer_id,
      crop_name,
      area_value:      parseFloat(area_value),
      area_unit:       area_unit || farmer.land_unit,
      plantation_date,
      harvesting_date,
      status:          status || "active",
    });

    // Sync allocated_land from actual segment sum
    const segmentSum = await db.LandSegment.sum("area_value", {
      where: { farmer_id: farmer.farmer_id },
    }) || 0;

    await farmer.update({
      allocated_land: segmentSum,
      available_land: Math.max(0, parseFloat(farmer.total_land) - segmentSum),
    });

    return res.status(201).json({ success: true, message: "Land segment created", data: segment });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── PUT /farmer-land/:id ──────────────────────────────────────
exports.update = async (req, res) => {
  try {
    const farmer = await db.Farmer.findOne({ where: { user_id: req.user.user_id } });
    if (!farmer) return res.status(404).json({ success: false, message: "Farmer not found" });

    const segment = await db.LandSegment.findOne({
      where: { segment_id: req.params.id, farmer_id: farmer.farmer_id },
    });
    if (!segment) return res.status(404).json({ success: false, message: "Land segment not found" });

    const { crop_name, area_value, area_unit, plantation_date, harvesting_date, status } = req.body;

    if (status && !allowedStatus.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Allowed values: ${allowedStatus.join(", ")}`,
      });
    }

    await segment.update({
      crop_name:       crop_name       || segment.crop_name,
      area_value:      area_value      ? parseFloat(area_value) : segment.area_value,
      area_unit:       area_unit       || segment.area_unit,
      plantation_date: plantation_date || segment.plantation_date,
      harvesting_date: harvesting_date || segment.harvesting_date,
      status:          status          || segment.status,
    });

    // Sync allocated_land from actual segment sum
    const segmentSum = await db.LandSegment.sum("area_value", {
      where: { farmer_id: farmer.farmer_id },
    }) || 0;

    await farmer.update({
      allocated_land: segmentSum,
      available_land: Math.max(0, parseFloat(farmer.total_land) - segmentSum),
    });

    return res.json({ success: true, message: "Land segment updated", data: segment });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── DELETE /farmer-land/:id ───────────────────────────────────
exports.delete = async (req, res) => {
  try {
    const farmer = await db.Farmer.findOne({ where: { user_id: req.user.user_id } });
    if (!farmer) return res.status(404).json({ success: false, message: "Farmer not found" });

    const segment = await db.LandSegment.findOne({
      where: { segment_id: req.params.id, farmer_id: farmer.farmer_id },
    });
    if (!segment) return res.status(404).json({ success: false, message: "Land segment not found" });

    await segment.destroy();

    // Sync allocated_land from actual segment sum
    const segmentSum = await db.LandSegment.sum("area_value", {
      where: { farmer_id: farmer.farmer_id },
    }) || 0;

    await farmer.update({
      allocated_land: segmentSum,
      available_land: Math.max(0, parseFloat(farmer.total_land) - segmentSum),
    });

    return res.json({ success: true, message: "Land segment deleted" });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};