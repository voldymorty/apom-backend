const { Op } = require("sequelize");
const db = require("../../models");

const ORDER_STATUS_META = {
  placed:     { label: "Placed",     color: "#3498DB" },
  confirmed:  { label: "Confirmed",  color: "#9B59B6" },
  processing: { label: "Processing", color: "#F1C40F" },
  ready:      { label: "Ready",      color: "#1ABC9C" },
  dispatched: { label: "Dispatched", color: "#E67E22" },
  delivered:  { label: "Delivered",  color: "#27AE60" },
  cancelled:  { label: "Cancelled",  color: "#E74C3C" },
  returned:   { label: "Returned",   color: "#95A5A6" },
};

function buildWeeklySeries(rows) {
  const map = new Map();
  for (const row of rows) {
    map.set(row.date, parseFloat(row.amount || 0));
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

function buildStatusBreakdown(rows) {
  const total = rows.reduce((sum, r) => sum + parseInt(r.count, 10), 0);

  return rows.map((row) => {
    const meta = ORDER_STATUS_META[row.order_status] || {
      label: row.order_status,
      color: "#7F8C8D",
    };
    const count = parseInt(row.count, 10);
    return {
      status: row.order_status,
      label: meta.label,
      color: meta.color,
      count,
      percentage: total > 0 ? parseFloat(((count / total) * 100).toFixed(1)) : 0,
    };
  });
}

exports.getDashboard = async (req, res) => {
  try {
    const vendor = await db.Vendor.findOne({ where: { user_id: req.user.user_id } });
    if (!vendor) return res.status(404).json({ success: false, message: "Vendor profile not found" });

    const vendorId = vendor.vendor_id;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // ── Month stats (orders + spend) ────────────────────────────
    const monthStats = await db.Order.findOne({
      where: {
        vendor_id: vendorId,
        payment_status: "paid",
        created_at: { [Op.gte]: startOfMonth },
      },
      attributes: [
        [db.sequelize.fn("COUNT", db.sequelize.col("order_id")), "order_count"],
        [db.sequelize.fn("SUM", db.sequelize.col("final_amount")), "total_spend"],
      ],
      raw: true,
    });

    const monthOrderCount = parseInt(monthStats?.order_count || 0, 10);
    const monthSpend = parseFloat(monthStats?.total_spend || 0);
    const avgOrderValue =
      monthOrderCount > 0
        ? parseFloat((monthSpend / monthOrderCount).toFixed(2))
        : 0;

    // ── Pending deliveries ───────────────────────────────────────
    const pendingDeliveries = await db.PickupDelivery.count({
      where: {
        vendor_id: vendorId,
        delivery_type: "delivery",
        status: { [Op.notIn]: ["completed", "cancelled", "failed"] },
      },
    });

    // ── Weekly spend chart (last 7 days) ──────────────────────────
    const dailySpendRows = await db.Order.findAll({
      where: {
        vendor_id: vendorId,
        payment_status: "paid",
        created_at: { [Op.gte]: sevenDaysAgo },
      },
      attributes: [
        [db.sequelize.fn("DATE_FORMAT", db.sequelize.col("created_at"), "%Y-%m-%d"), "date"],
        [db.sequelize.fn("SUM", db.sequelize.col("final_amount")), "amount"],
      ],
      group: [db.sequelize.fn("DATE_FORMAT", db.sequelize.col("created_at"), "%Y-%m-%d")],
      raw: true,
    });
    const weeklyChart = buildWeeklySeries(dailySpendRows);

    // ── Order status breakdown (last 30 days) ─────────────────────
    const statusRows = await db.Order.findAll({
      where: {
        vendor_id: vendorId,
        created_at: { [Op.gte]: thirtyDaysAgo },
      },
      attributes: [
        "order_status",
        [db.sequelize.fn("COUNT", db.sequelize.col("order_id")), "count"],
      ],
      group: ["order_status"],
      raw: true,
    });
    const statusBreakdown = buildStatusBreakdown(statusRows);

    // ── Latest delivery status ──────────────────────────────────────
    const latestDelivery = await db.PickupDelivery.findOne({
      where: { vendor_id: vendorId, delivery_type: "delivery" },
      order: [["created_at", "DESC"]],
      attributes: ["delivery_id", "delivery_number", "status", "scheduled_date", "estimated_time_minutes"],
    });

    let deliveryInfo = {
      status: "No active delivery",
      message: "No deliveries scheduled",
    };
    if (latestDelivery) {
      const statusMap = {
        assigned:   { status: "Assigned",   message: "Driver assigned" },
        accepted:   { status: "Accepted",   message: "Driver accepted the delivery" },
        in_transit: { status: "On the way", message: "Your order is on the way 🚚" },
        reached:    { status: "Reached",    message: "Driver has reached the location" },
        completed:  { status: "Delivered",  message: "Order delivered successfully 🎉" },
        failed:     { status: "Failed",     message: "Delivery failed. Contact support." },
        cancelled:  { status: "Cancelled",  message: "Delivery was cancelled" },
      };
      const info = statusMap[latestDelivery.status] || { status: latestDelivery.status, message: "" };
      deliveryInfo = {
        delivery_id: latestDelivery.delivery_id,
        delivery_number: latestDelivery.delivery_number,
        status: info.status,
        message: info.message,
        estimated_time_minutes: latestDelivery.estimated_time_minutes
          ? `${latestDelivery.estimated_time_minutes} mins`
          : latestDelivery.scheduled_date || null,
      };
    }

    return res.json({
      success: true,
      data: {
        vendor: {
          shop_name: vendor.shop_name,
          vendor_photo_url: vendor.vendor_photo_url,
        },
        hero: {
          month_label: now.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
          month_spend: monthSpend,
        },
        stats: {
          total_orders: monthOrderCount,
          total_spend: monthSpend,
          pending_deliveries: pendingDeliveries,
          avg_order_value: avgOrderValue,
        },
        weekly_chart: weeklyChart,
        order_status_breakdown: statusBreakdown,
        delivery_status: deliveryInfo,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};