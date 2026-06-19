const router = require("express").Router();
const ctrl = require("../../controllers/vendor/homeController");
const { authenticate } = require("../../middleware/auth");

/**
 * @swagger
 * /vendor/home/dashboard:
 *   get:
 *     summary: Get home screen dashboard data
 *     description: |
 *       Returns the vendor analytics dashboard:
 *       - Vendor info (name + photo for app bar)
 *       - Hero (current month label + spend)
 *       - Stats (total orders, total spend, pending deliveries, avg order value — current month)
 *       - Weekly chart (last 7 days spend, for bar chart)
 *       - Order status breakdown (last 30 days, for donut chart)
 *       - Delivery status (latest delivery)
 *     tags: [Vendor Home]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard data
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 vendor:
 *                   shop_name: "Green Life Market"
 *                   vendor_photo_url: "http://..."
 *                 hero:
 *                   month_label: "June 2026"
 *                   month_spend: 18450.00
 *                 stats:
 *                   total_orders: 12
 *                   total_spend: 18450.00
 *                   pending_deliveries: 2
 *                   avg_order_value: 1537.50
 *                 weekly_chart:
 *                   labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
 *                   data: [1200, 0, 3400, 800, 0, 2100, 1500]
 *                 order_status_breakdown:
 *                   - status: "delivered"
 *                     label: "Delivered"
 *                     color: "#27AE60"
 *                     count: 8
 *                     percentage: 66.7
 *                   - status: "placed"
 *                     label: "Placed"
 *                     color: "#3498DB"
 *                     count: 4
 *                     percentage: 33.3
 *                 delivery_status:
 *                   status: "On the way"
 *                   message: "Your order is on the way 🚚"
 *                   estimated_time_minutes: "25 mins"
 */
router.get("/dashboard", authenticate, ctrl.getDashboard);

module.exports = router;