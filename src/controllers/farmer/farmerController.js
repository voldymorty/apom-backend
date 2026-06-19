const db = require("../../models");
const { Op } = require("sequelize");

const monthNames = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

// Static fallback seeds — used when no real order history exists yet.
// Keys are month numbers (1–12), values are top 5 crops with demand_ratio.
const STATIC_FALLBACK = {
  1:  [{ crop: "Tomatoes", ratio: 0.30 }, { crop: "Carrots",  ratio: 0.25 }, { crop: "Spinach",   ratio: 0.20 }, { crop: "Potatoes", ratio: 0.15 }, { crop: "Onions",    ratio: 0.10 }],
  2:  [{ crop: "Carrots",  ratio: 0.28 }, { crop: "Tomatoes", ratio: 0.25 }, { crop: "Onions",    ratio: 0.20 }, { crop: "Spinach",  ratio: 0.15 }, { crop: "Cucumbers", ratio: 0.12 }],
  3:  [{ crop: "Onions",   ratio: 0.30 }, { crop: "Tomatoes", ratio: 0.25 }, { crop: "Cucumbers", ratio: 0.20 }, { crop: "Carrots",  ratio: 0.15 }, { crop: "Peppers",   ratio: 0.10 }],
  4:  [{ crop: "Cucumbers",ratio: 0.28 }, { crop: "Peppers",  ratio: 0.25 }, { crop: "Tomatoes",  ratio: 0.22 }, { crop: "Onions",   ratio: 0.15 }, { crop: "Spinach",   ratio: 0.10 }],
  5:  [{ crop: "Peppers",  ratio: 0.30 }, { crop: "Cucumbers",ratio: 0.25 }, { crop: "Tomatoes",  ratio: 0.20 }, { crop: "Carrots",  ratio: 0.15 }, { crop: "Potatoes",  ratio: 0.10 }],
  6:  [{ crop: "Tomatoes", ratio: 0.32 }, { crop: "Peppers",  ratio: 0.24 }, { crop: "Cucumbers", ratio: 0.20 }, { crop: "Onions",   ratio: 0.14 }, { crop: "Carrots",   ratio: 0.10 }],
  7:  [{ crop: "Spinach",  ratio: 0.28 }, { crop: "Tomatoes", ratio: 0.26 }, { crop: "Potatoes",  ratio: 0.20 }, { crop: "Carrots",  ratio: 0.14 }, { crop: "Peppers",   ratio: 0.12 }],
  8:  [{ crop: "Potatoes", ratio: 0.30 }, { crop: "Onions",   ratio: 0.25 }, { crop: "Tomatoes",  ratio: 0.20 }, { crop: "Spinach",  ratio: 0.15 }, { crop: "Carrots",   ratio: 0.10 }],
  9:  [{ crop: "Carrots",  ratio: 0.28 }, { crop: "Potatoes", ratio: 0.24 }, { crop: "Spinach",   ratio: 0.20 }, { crop: "Tomatoes", ratio: 0.16 }, { crop: "Onions",    ratio: 0.12 }],
  10: [{ crop: "Onions",   ratio: 0.30 }, { crop: "Carrots",  ratio: 0.25 }, { crop: "Potatoes",  ratio: 0.20 }, { crop: "Tomatoes", ratio: 0.15 }, { crop: "Spinach",   ratio: 0.10 }],
  11: [{ crop: "Spinach",  ratio: 0.28 }, { crop: "Carrots",  ratio: 0.24 }, { crop: "Onions",    ratio: 0.20 }, { crop: "Potatoes", ratio: 0.16 }, { crop: "Tomatoes",  ratio: 0.12 }],
  12: [{ crop: "Tomatoes", ratio: 0.30 }, { crop: "Spinach",  ratio: 0.25 }, { crop: "Carrots",   ratio: 0.22 }, { crop: "Onions",   ratio: 0.14 }, { crop: "Potatoes",  ratio: 0.09 }],
};

/**
 * Builds top-5 crop demand for a given month from real order_items data.
 * Joins order_items → products, groups by product_name, sums qty + counts orders.
 * Returns null if no data found (caller falls back to static).
 */
async function buildLiveMonthDemand(month) {
  const lastYear = new Date().getFullYear() - 1;
  const start = new Date(lastYear, month - 1, 1);
  const end   = new Date(lastYear, month, 0, 23, 59, 59, 999);

  const rows = await db.OrderItem.findAll({
    attributes: [
      [db.sequelize.fn("SUM", db.sequelize.col("OrderItem.quantity_kg")), "total_kg"],
      [db.sequelize.fn("COUNT", db.sequelize.col("OrderItem.order_item_id")), "order_count"],
    ],
    include: [
      {
        model: db.Order,
        as: "order",
        where: {
          payment_status: "paid",
          created_at: { [Op.between]: [start, end] },
        },
        attributes: [],
      },
      {
        model: db.Product,
        as: "product",
        attributes: ["product_name"],
      },
    ],
    group: ["product.product_id", "product.product_name"],
    order: [[db.sequelize.literal("total_kg"), "DESC"]],
    limit: 5,
    raw: false,
  });

  if (!rows.length) return null;

  const totalKg = rows.reduce((sum, r) => sum + parseFloat(r.get("total_kg") || 0), 0);

  return rows.map((r) => ({
    crop:        r.product.product_name,
    total_kg:    parseFloat(parseFloat(r.get("total_kg") || 0).toFixed(2)),
    order_count: parseInt(r.get("order_count") || 0, 10),
    ratio:       totalKg > 0
      ? parseFloat((parseFloat(r.get("total_kg")) / totalKg).toFixed(4))
      : 0,
  }));
}

async function buildWeeklyPickupSeries(farmerId) {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const rows = await db.PickupDelivery.findAll({
    where: {
      farmer_id: farmerId,
      delivery_type: "pickup",
      status: "completed",
      completed_at: { [Op.gte]: sevenDaysAgo },
    },
    attributes: [
      [db.sequelize.fn("DATE_FORMAT", db.sequelize.col("completed_at"), "%Y-%m-%d"), "date"],
      [db.sequelize.fn("SUM", db.sequelize.col("actual_quantity_kg")), "total_kg"],
    ],
    group: [db.sequelize.fn("DATE_FORMAT", db.sequelize.col("completed_at"), "%Y-%m-%d")],
    raw: true,
  });

  const map = new Map();
  for (const row of rows) {
    map.set(row.date, parseFloat(row.total_kg || 0));
  }

  const labels = [];
  const data = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    labels.push(d.toLocaleDateString("en-US", { weekday: "short" }));
    data.push(map.get(key) || 0);
  }
  return { labels, data };
}

/**
 * Formats a demand row list into the response shape.
 * Works for both live rows (have total_kg/order_count) and static fallbacks.
 */
function formatDemandSlices(rows) {
  return rows.map((r) => ({
    crop:        r.crop,
    ratio:       r.ratio,
    total_kg:    r.total_kg    ?? null,
    order_count: r.order_count ?? null,
  }));
}

// ─── GET /farmers/dashboard ────────────────────────────────────
exports.getDashboard = async (req, res) => {
  try {
    const farmer = await db.Farmer.findOne({
      where: { user_id: req.user.user_id },
      include: [
        { model: db.State,    as: "state_info",    attributes: ["state_id", "state_name"] },
        { model: db.District, as: "district_info", attributes: ["district_id", "district_name"] },
        { model: db.City,     as: "city_info",     attributes: ["city_id", "city_name"] },
      ],
    });
    if (!farmer) return res.status(404).json({ success: false, message: "Farmer not found" });

    const currentMonth = new Date().getMonth() + 1;

    const [
      availableCropsCount,
      totalSegments,
      pendingPickups,
      totalSoldKg,
      monthlyEarnings,
      weeklyPickups,
      totalEarnings
    ] = await Promise.all([
      db.LandSegment.count({ where: { farmer_id: farmer.farmer_id, status: "active" } }),
      db.LandSegment.count({ where: { farmer_id: farmer.farmer_id } }),
      db.PickupDelivery.count({
        where: {
          farmer_id: farmer.farmer_id,
          delivery_type: "pickup",
          status: { [Op.in]: ["assigned", "accepted", "in_transit", "reached"] },
        },
      }),
      db.PickupDelivery.sum("actual_quantity_kg", {
        where: { farmer_id: farmer.farmer_id, status: "completed" },
      }),
      db.FarmerEarning.sum("net_amount", {
        where: {
          farmer_id: farmer.farmer_id,
          created_at: {
            [Op.gte]: new Date(new Date().getFullYear(), currentMonth - 1, 1),
            [Op.lte]: new Date(new Date().getFullYear(), currentMonth, 0),
          },
        },
      }),
      buildWeeklyPickupSeries(farmer.farmer_id),
      db.FarmerEarning.sum("net_amount", {
        where: {
          farmer_id: farmer.farmer_id,
        },
      }),
    ]);

    // Build all-months demand map for the selector (live → static fallback per month)
    const allMonthlyDemand = {};
    for (let m = 1; m <= 12; m++) {
      const live = await buildLiveMonthDemand(m);
      const rows = live || STATIC_FALLBACK[m];
      allMonthlyDemand[m] = {
        slices:     formatDemandSlices(rows),
        is_live:    !!live,
        data_year:  live ? new Date().getFullYear() - 1 : null,
      };
    }

    const currentMonthData = allMonthlyDemand[currentMonth];
    const topSuggestedCrop = currentMonthData.slices[0]?.crop || "N/A";

    return res.json({
      success: true,
      data: {
        farmer_id:         farmer.farmer_id,
        full_name:         farmer.full_name,
        profile_photo_url: farmer.profile_photo_url,
        land_photo_url:    farmer.land_photo_url,
        farm_name:         farmer.farm_name,
        location: {
          state:    farmer.state_info    || null,
          district: farmer.district_info || null,
          city:     farmer.city_info     || null,
          pincode:  farmer.pincode,
        },
        total_land:     farmer.total_land,
        land_unit:      farmer.land_unit,
        allocated_land: farmer.allocated_land,
        available_land: farmer.available_land,
        total_segments: totalSegments,
        weekly_pickups:   weeklyPickups,

        available_crops:  availableCropsCount,
        total_sold_tons:  totalSoldKg ? parseFloat((totalSoldKg / 1000).toFixed(2)) : 0,
        monthly_earnings: monthlyEarnings || 0,
        pending_pickups:  pendingPickups,
        total_earnings:   totalEarnings || 0,

        current_month:      currentMonth,
        current_month_name: monthNames[currentMonth - 1],
        top_suggested_crop: topSuggestedCrop,
        all_monthly_demand: allMonthlyDemand,
        current_month_demand: currentMonthData,
      },
    });
  } catch (err) {
    console.error("getDashboard error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── GET /farmers/market-demand?month=3 ───────────────────────
exports.getMarketDemand = async (req, res) => {
  try {
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;
    if (month < 1 || month > 12) {
      return res.status(400).json({ success: false, message: "month must be between 1 and 12" });
    }

    const live = await buildLiveMonthDemand(month);
    const rows = live || STATIC_FALLBACK[month];
    const isLive = !!live;
    const lastYear = new Date().getFullYear() - 1;

    return res.json({
      success: true,
      data: {
        month,
        month_name:        monthNames[month - 1],
        top_suggested_crop: rows[0]?.crop || "N/A",
        is_live:           isLive,
        data_year:         isLive ? lastYear : null,
        insight_label:     isLive
          ? `Based on actual orders from ${monthNames[month - 1]} ${lastYear}`
          : `Estimated demand — actual data available after first full year`,
        slices: formatDemandSlices(rows),
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};