"use strict";

const { sequelize } = require("../../models");
const { QueryTypes, Op } = require("sequelize");
const dayjs = require("dayjs");

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Returns { from, to } as JS Date objects.
 * Defaults to last 30 days if query params are absent.
 */
function resolveDateRange(query) {
  const to   = query.to   ? dayjs(query.to).endOf("day")     : dayjs().endOf("day");
  const from = query.from ? dayjs(query.from).startOf("day") : to.subtract(29, "day").startOf("day");
  return { from: from.toDate(), to: to.toDate() };
}

// ─── 1. Summary Stats ────────────────────────────────────────────────────────

/**
 * GET /admin/dashboard/summary
 * High-level platform counts & financials.
 */
exports.getSummaryStats = async (req, res) => {
  try {
    const { from, to } = resolveDateRange(req.query);

    const [users] = await sequelize.query(
      `SELECT
        COUNT(*) AS total_users,

        SUM(role = 'farmer' AND profile_complete = 1) AS total_farmers,

        SUM(role = 'vendor' AND profile_complete = 1) AS total_vendors,

        SUM(role = 'delivery') AS total_delivery_personnel,

        SUM(
          role = 'farmer'
          AND profile_complete = 1
          AND created_at BETWEEN :from AND :to
        ) AS new_farmers,

        SUM(
          role = 'vendor'
          AND profile_complete = 1
          AND created_at BETWEEN :from AND :to
        ) AS new_vendors,

        SUM(
          role = 'delivery'
          AND created_at BETWEEN :from AND :to
        ) AS new_delivery_personnel

      FROM users
      WHERE is_active = 1`,
      { replacements: { from, to }, type: QueryTypes.SELECT }
    );

    const [orders] = await sequelize.query(
      `SELECT
         COUNT(*)                          AS total_orders,
         SUM(order_status = 'delivered')   AS completed_orders,
         SUM(order_status = 'cancelled')   AS cancelled_orders,
         SUM(order_status = 'placed' OR order_status = 'confirmed'
             OR order_status = 'processing') AS pending_orders,
         COALESCE(SUM(final_amount), 0)    AS total_order_value
       FROM orders
       WHERE created_at BETWEEN :from AND :to`,
      { replacements: { from, to }, type: QueryTypes.SELECT }
    );

    const [revenue] = await sequelize.query(
      `SELECT
         COALESCE(SUM(amount), 0)                            AS total_revenue,
         COALESCE(SUM(CASE WHEN payment_status = 'success'
                           THEN amount ELSE 0 END), 0)       AS collected_revenue,
         COALESCE(SUM(refund_amount), 0)                     AS total_refunds
       FROM payments
       WHERE created_at BETWEEN :from AND :to`,
      { replacements: { from, to }, type: QueryTypes.SELECT }
    );

    const [inventory] = await sequelize.query(
      `SELECT
         COALESCE(SUM(available_quantity_kg), 0)  AS total_stock_kg,
         COUNT(CASE WHEN available_quantity_kg <= minimum_stock_alert
                    THEN 1 END)                   AS low_stock_products
       FROM inventory`,
      { type: QueryTypes.SELECT }
    );

    const [deliveries] = await sequelize.query(
      `SELECT
         COUNT(*)                           AS total_deliveries,
         SUM(status = 'completed')          AS completed_deliveries,
         SUM(status = 'failed')             AS failed_deliveries,
         SUM(status IN ('assigned','accepted','in_transit')) AS active_deliveries
       FROM pickup_deliveries
       WHERE created_at BETWEEN :from AND :to`,
      { replacements: { from, to }, type: QueryTypes.SELECT }
    );

    return res.json({
      success: true,
      data: {
        period: {
          from: dayjs(from).format("YYYY-MM-DD"),
          to:   dayjs(to).format("YYYY-MM-DD"),
        },
        users:      users,
        orders:     orders,
        revenue:    revenue,
        inventory:  inventory,
        deliveries: deliveries,
      },
    });
  } catch (err) {
    console.error("getSummaryStats:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── 2. Daily Reports ────────────────────────────────────────────────────────

/**
 * GET /admin/dashboard/daily-reports
 * Returns rows from the daily_reports table for the requested range.
 * Query params: from, to, page (default 1), limit (default 30)
 */
exports.getDailyReports = async (req, res) => {
  try {
    const { from, to } = resolveDateRange(req.query);
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(90, parseInt(req.query.limit) || 30);
    const offset = (page - 1) * limit;

    const reports = await sequelize.query(
      `SELECT *
       FROM   daily_reports
       WHERE  report_date BETWEEN :from AND :to
       ORDER  BY report_date DESC
       LIMIT  :limit OFFSET :offset`,
      { replacements: { from, to, limit, offset }, type: QueryTypes.SELECT }
    );

    const [{ total }] = await sequelize.query(
      `SELECT COUNT(*) AS total
       FROM   daily_reports
       WHERE  report_date BETWEEN :from AND :to`,
      { replacements: { from, to }, type: QueryTypes.SELECT }
    );

    return res.json({
      success: true,
      data: {
        reports,
        pagination: {
          total:       Number(total),
          page,
          limit,
          total_pages: Math.ceil(Number(total) / limit),
        },
      },
    });
  } catch (err) {
    console.error("getDailyReports:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * GET /admin/dashboard/daily-reports/:date
 * Returns single daily report for a specific date (YYYY-MM-DD).
 */
exports.getDailyReportByDate = async (req, res) => {
  try {
    const { date } = req.params;
    if (!dayjs(date, "YYYY-MM-DD", true).isValid()) {
      return res.status(400).json({ success: false, message: "Invalid date format. Use YYYY-MM-DD" });
    }

    const [report] = await sequelize.query(
      `SELECT * FROM daily_reports WHERE report_date = :date LIMIT 1`,
      { replacements: { date }, type: QueryTypes.SELECT }
    );

    if (!report) {
      return res.status(404).json({ success: false, message: "No report found for this date" });
    }

    return res.json({ success: true, data: report });
  } catch (err) {
    console.error("getDailyReportByDate:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── 3. Charts Data (Trends) ─────────────────────────────────────────────────

/**
 * GET /admin/dashboard/charts/orders
 * Daily order count & value trend for the given date range.
 */
exports.getOrderTrend = async (req, res) => {
  try {
    const { from, to } = resolveDateRange(req.query);

    const rows = await sequelize.query(
      `SELECT
         DATE(created_at)              AS date,
         COUNT(*)                      AS total_orders,
         SUM(order_status='delivered') AS completed_orders,
         SUM(order_status='cancelled') AS cancelled_orders,
         COALESCE(SUM(final_amount),0) AS total_value
       FROM   orders
       WHERE  created_at BETWEEN :from AND :to
       GROUP  BY DATE(created_at)
       ORDER  BY date ASC`,
      { replacements: { from, to }, type: QueryTypes.SELECT }
    );

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error("getOrderTrend:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * GET /admin/dashboard/charts/revenue
 * Daily revenue trend (collected payments).
 */
exports.getRevenueTrend = async (req, res) => {
  try {
    const { from, to } = resolveDateRange(req.query);

    const rows = await sequelize.query(
      `SELECT
         DATE(transaction_date)                              AS date,
         COALESCE(SUM(amount),0)                            AS gross_revenue,
         COALESCE(SUM(CASE WHEN payment_status = 'success'
                           THEN amount ELSE 0 END), 0)      AS collected_revenue,
         COALESCE(SUM(refund_amount), 0)                    AS refunds,
         COUNT(*)                                           AS total_transactions,
         SUM(payment_status = 'success')                    AS successful_transactions,
         SUM(payment_status = 'failed')                     AS failed_transactions
       FROM   payments
       WHERE  transaction_date BETWEEN :from AND :to
       GROUP  BY DATE(transaction_date)
       ORDER  BY date ASC`,
      { replacements: { from, to }, type: QueryTypes.SELECT }
    );

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error("getRevenueTrend:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * GET /admin/dashboard/charts/deliveries
 * Daily delivery & pickup completion trend.
 */
exports.getDeliveryTrend = async (req, res) => {
  try {
    const { from, to } = resolveDateRange(req.query);

    const rows = await sequelize.query(
      `SELECT
         DATE(created_at)           AS date,
         delivery_type,
         COUNT(*)                   AS total,
         SUM(status='completed')    AS completed,
         SUM(status='failed')       AS failed,
         SUM(status='cancelled')    AS cancelled
       FROM   pickup_deliveries
       WHERE  created_at BETWEEN :from AND :to
       GROUP  BY DATE(created_at), delivery_type
       ORDER  BY date ASC, delivery_type ASC`,
      { replacements: { from, to }, type: QueryTypes.SELECT }
    );

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error("getDeliveryTrend:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * GET /admin/dashboard/charts/registrations
 * Daily new user registrations by role.
 */
exports.getRegistrationTrend = async (req, res) => {
  try {
    const { from, to } = resolveDateRange(req.query);

    const rows = await sequelize.query(
      `SELECT
         DATE(created_at) AS date,
         role,
         COUNT(*) AS count
       FROM users
       WHERE created_at BETWEEN :from AND :to
         AND role IN ('farmer', 'vendor', 'delivery')
         AND (
           role = 'delivery'
           OR (role IN ('farmer', 'vendor') AND profile_complete = 1)
         )
       GROUP BY DATE(created_at), role
       ORDER BY date ASC, role ASC`,
      {
        replacements: { from, to },
        type: QueryTypes.SELECT
      }
    );

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error("getRegistrationTrend:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

/**
 * GET /admin/dashboard/charts/procurement
 * Daily crop procurement quantity trend (kg picked up from farmers).
 */
exports.getProcurementTrend = async (req, res) => {
  try {
    const { from, to } = resolveDateRange(req.query);

    const rows = await sequelize.query(
      `SELECT
         DATE(pd.created_at)                  AS date,
         COALESCE(SUM(pd.actual_quantity_kg), 0) AS total_quantity_kg,
         COUNT(*)                             AS total_pickups,
         SUM(pd.status = 'completed')         AS completed_pickups
       FROM   pickup_deliveries pd
       WHERE  pd.delivery_type = 'pickup'
         AND  pd.created_at BETWEEN :from AND :to
       GROUP  BY DATE(pd.created_at)
       ORDER  BY date ASC`,
      { replacements: { from, to }, type: QueryTypes.SELECT }
    );

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error("getProcurementTrend:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── 4. Top Performers ───────────────────────────────────────────────────────

/**
 * GET /admin/dashboard/top/farmers
 * Top farmers by total quantity supplied in the period.
 * Query params: from, to, limit (default 10)
 */
exports.getTopFarmers = async (req, res) => {
  try {
    const { from, to } = resolveDateRange(req.query);
    const limit = Math.min(50, parseInt(req.query.limit) || 10);

    const rows = await sequelize.query(
      `SELECT
         f.farmer_id,
         f.full_name,
         f.farm_name,
         u.mobile_number,
         COALESCE(SUM(fe.quantity_supplied_kg), 0)  AS total_quantity_kg,
         COALESCE(SUM(fe.net_amount), 0)            AS total_earnings,
         COUNT(DISTINCT fe.earning_id)              AS total_supplies
       FROM   farmers f
       JOIN   users u ON u.user_id = f.user_id
       LEFT JOIN farmer_earnings fe
              ON fe.farmer_id = f.farmer_id
             AND fe.created_at BETWEEN :from AND :to
       GROUP  BY f.farmer_id, f.full_name, f.farm_name, u.mobile_number
       ORDER  BY total_quantity_kg DESC
       LIMIT  :limit`,
      { replacements: { from, to, limit }, type: QueryTypes.SELECT }
    );

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error("getTopFarmers:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * GET /admin/dashboard/top/vendors
 * Top vendors by total order value in the period.
 */
exports.getTopVendors = async (req, res) => {
  try {
    const { from, to } = resolveDateRange(req.query);
    const limit = Math.min(50, parseInt(req.query.limit) || 10);

    const rows = await sequelize.query(
      `SELECT
         v.vendor_id,
         v.shop_name,
         v.owner_name,
         v.business_type,
         u.mobile_number,
         COUNT(DISTINCT o.order_id)          AS total_orders,
         COALESCE(SUM(o.final_amount), 0)    AS total_order_value,
         SUM(o.order_status = 'delivered')   AS completed_orders,
         SUM(o.order_status = 'cancelled')   AS cancelled_orders
       FROM   vendors v
       JOIN   users u ON u.user_id = v.user_id
       LEFT JOIN orders o
              ON o.vendor_id = v.vendor_id
             AND o.created_at BETWEEN :from AND :to
       GROUP  BY v.vendor_id, v.shop_name, v.owner_name, v.business_type, u.mobile_number
       ORDER  BY total_order_value DESC
       LIMIT  :limit`,
      { replacements: { from, to, limit }, type: QueryTypes.SELECT }
    );

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error("getTopVendors:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * GET /admin/dashboard/top/products
 * Top products by sales volume (kg sold via order_items) in the period.
 */
exports.getTopProducts = async (req, res) => {
  try {
    const { from, to } = resolveDateRange(req.query);
    const limit = Math.min(50, parseInt(req.query.limit) || 10);

    const rows = await sequelize.query(
      `SELECT
         p.product_id,
         p.product_name,
         p.product_code,
         p.unit,
         c.category_name,
         COALESCE(SUM(oi.quantity_kg), 0)    AS total_quantity_sold_kg,
         COALESCE(SUM(oi.total_price), 0)    AS total_revenue,
         COUNT(DISTINCT oi.order_id)         AS times_ordered,
         AVG(oi.price_per_kg)                AS avg_price_per_kg
       FROM   products p
       JOIN   categories c ON c.category_id = p.category_id
       LEFT JOIN order_items oi ON oi.product_id = p.product_id
       LEFT JOIN orders o
              ON o.order_id = oi.order_id
             AND o.created_at BETWEEN :from AND :to
             AND o.order_status != 'cancelled'
       WHERE  p.is_active = 1
       GROUP  BY p.product_id, p.product_name, p.product_code, p.unit, c.category_name
       ORDER  BY total_quantity_sold_kg DESC
       LIMIT  :limit`,
      { replacements: { from, to, limit }, type: QueryTypes.SELECT }
    );

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error("getTopProducts:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * GET /admin/dashboard/top/delivery-personnel
 * Top delivery personnel by completed deliveries in the period.
 */
exports.getTopDeliveryPersonnel = async (req, res) => {
  try {
    const { from, to } = resolveDateRange(req.query);
    const limit = Math.min(50, parseInt(req.query.limit) || 10);

    const rows = await sequelize.query(
      `SELECT
         dp.delivery_person_id,
         dp.full_name,
         dp.vehicle_type,
         dp.vehicle_number,
         dp.rating,
         u.mobile_number,
         COUNT(DISTINCT pd.delivery_id)          AS total_assigned,
         SUM(pd.status = 'completed')            AS completed_deliveries,
         SUM(pd.status = 'failed')               AS failed_deliveries,
         COALESCE(SUM(pd.actual_distance_km), 0) AS total_distance_km,
         ROUND(
           SUM(pd.status = 'completed') /
           NULLIF(COUNT(DISTINCT pd.delivery_id), 0) * 100
         , 1)                                    AS completion_rate_pct
       FROM   delivery_personnel dp
       JOIN   users u ON u.user_id = dp.user_id
       LEFT JOIN pickup_deliveries pd
              ON pd.delivery_person_id = dp.delivery_person_id
             AND pd.created_at BETWEEN :from AND :to
       GROUP  BY dp.delivery_person_id, dp.full_name, dp.vehicle_type,
                 dp.vehicle_number, dp.rating, u.mobile_number
       ORDER  BY completed_deliveries DESC
       LIMIT  :limit`,
      { replacements: { from, to, limit }, type: QueryTypes.SELECT }
    );

    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error("getTopDeliveryPersonnel:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};