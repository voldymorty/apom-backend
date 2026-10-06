const db = require("../../models");
const { Op } = require("sequelize");

const allowedStatus = ["active", "fallow", "harvested"];
const allowedYieldUnits = ["kg", "ton"];

// Resolve a product_id to its record, snapshotting the name server-side
// so crop_name always comes from the Crop API rather than client text.
async function resolveProduct(product_id) {
  const id = parseInt(product_id, 10);
  if (Number.isNaN(id)) return null;
  return db.Product.findByPk(id);
}

// Crop partitions only need to fit within the farmer's total land — they
// don't need to add up to it. The remainder is automatically fallow land.
function assertWithinTotalLand({ farmer, incomingArea, excludeSegmentId = null }) {
  return db.LandSegment.sum("area_value", {
    where: {
      farmer_id: farmer.farmer_id,
      ...(excludeSegmentId ? { segment_id: { [Op.ne]: excludeSegmentId } } : {}),
    },
  }).then((existingSum) => {
    const projected = (existingSum || 0) + incomingArea;
    const totalLand = parseFloat(farmer.total_land);
    if (projected - totalLand > 0.01) {
      return `Allocated crop land (${projected}) cannot exceed total land (${totalLand})`;
    }
    return null;
  });
}

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

    const {
      product_id, area_value, area_unit, plantation_date, harvesting_date, status,
      expected_yield_value, expected_yield_unit,
    } = req.body;

    if (status && !allowedStatus.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Allowed values: ${allowedStatus.join(", ")}`,
      });
    }

    if (expected_yield_unit && !allowedYieldUnits.includes(expected_yield_unit)) {
      return res.status(400).json({
        success: false,
        message: `Invalid expected_yield_unit. Allowed values: ${allowedYieldUnits.join(", ")}`,
      });
    }

    const product = await resolveProduct(product_id);
    if (!product) {
      return res.status(400).json({ success: false, message: "A valid product_id from the crop catalog is required" });
    }

    const parsedArea = parseFloat(area_value);
    if (!(parsedArea > 0)) {
      return res.status(400).json({ success: false, message: "area_value must be a positive number" });
    }

    const capError = await assertWithinTotalLand({ farmer, incomingArea: parsedArea });
    if (capError) {
      return res.status(400).json({ success: false, message: capError });
    }

    const segment = await db.LandSegment.create({
      farmer_id:       farmer.farmer_id,
      product_id:      product.product_id,
      crop_name:       product.product_name,
      area_value:      parsedArea,
      area_unit:       area_unit || farmer.land_unit,
      expected_yield_value: expected_yield_value != null ? parseFloat(expected_yield_value) : null,
      expected_yield_unit:  expected_yield_unit || "kg",
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

    const {
      product_id, area_value, area_unit, plantation_date, harvesting_date, status,
      expected_yield_value, expected_yield_unit,
    } = req.body;

    if (status && !allowedStatus.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Allowed values: ${allowedStatus.join(", ")}`,
      });
    }

    if (expected_yield_unit && !allowedYieldUnits.includes(expected_yield_unit)) {
      return res.status(400).json({
        success: false,
        message: `Invalid expected_yield_unit. Allowed values: ${allowedYieldUnits.join(", ")}`,
      });
    }

    let product = null;
    if (product_id !== undefined) {
      product = await resolveProduct(product_id);
      if (!product) {
        return res.status(400).json({ success: false, message: "A valid product_id from the crop catalog is required" });
      }
    }

    const newArea = area_value ? parseFloat(area_value) : parseFloat(segment.area_value);
    if (!(newArea > 0)) {
      return res.status(400).json({ success: false, message: "area_value must be a positive number" });
    }

    if (area_value) {
      const capError = await assertWithinTotalLand({
        farmer, incomingArea: newArea, excludeSegmentId: segment.segment_id,
      });
      if (capError) {
        return res.status(400).json({ success: false, message: capError });
      }
    }

    await segment.update({
      product_id:      product ? product.product_id : segment.product_id,
      crop_name:       product ? product.product_name : segment.crop_name,
      area_value:      newArea,
      area_unit:       area_unit       || segment.area_unit,
      expected_yield_value: expected_yield_value != null ? parseFloat(expected_yield_value) : segment.expected_yield_value,
      expected_yield_unit:  expected_yield_unit || segment.expected_yield_unit,
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