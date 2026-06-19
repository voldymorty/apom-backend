require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./swagger/swaggerConfig");

const app = express();

// ─── Middleware ───────────────────────────────────────────────
app.use((req, res, next) => {
  console.log(`${req.method} ${req.originalUrl}`);
  next();
});
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Static uploads ───────────────────────────────────────────
app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"))
);

// ─── Swagger Docs ─────────────────────────────────────────────
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customSiteTitle: "APOM Farmer API Docs",
  })
);

app.get("/api-docs.json", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerSpec);
});

// ─── Routes ───────────────────────────────────────────────────

// ── Admin ─────────────────────────────────────────────────────
app.use("/api/admin/auth",     require("./routes/admin/authRoutes"));
app.use("/api/admin/farmers",     require("./routes/admin/farmerRoutes"));
app.use("/api/admin/vendors",     require("./routes/admin/vendorRoutes"));
app.use("/api/admin/delivery-personnel", require("./routes/admin/DeliverypersonnelRoutes"));
app.use("/api/admin/products", require("./routes/admin/ProductRoutes"));
app.use("/api/admin/pricing", require("./routes/admin/PricingRoutes"));
app.use("/api/admin/inventory", require("./routes/admin/InventoryRoutes"));
app.use("/api/admin/orders", require("./routes/admin/OrderRoutes"));
app.use("/api/admin/pickups-deliveries", require("./routes/admin/PickupdeliveryRoutes"));
app.use("/api/admin/routes", require("./routes/admin/DeliveryrouteRoutes"));
app.use("/api/admin/dashboard", require("./routes/admin/DashboardRoutes"));
app.use("/api/admin/payouts", require("./routes/admin/PayoutRoutes"));
app.use("/api/admin/commission", require("./routes/admin/CommissionRoutes"));
app.use("/api/admin/audit-logs", require("./routes/admin/PayoutRoutes"));
app.use("/api/admin/notifications", require("./routes/admin/NotificationRoutes"));

// ── Farmer ────────────────────────────────────────────────────
app.use("/api/auth",           require("./routes/farmer/authRoutes"));
app.use("/api/farmers",        require("./routes/farmer/farmerRoutes"));
app.use("/api/farmer-crops",   require("./routes/farmer/farmerCropRoutes"));
app.use("/api/farmer-land",    require("./routes/farmer/farmerLandRoutes"));
app.use("/api/farmer/notifications", require("./routes/farmer/notificationRoutes"));

// ── Vendor ────────────────────────────────────────────────────
app.use("/api/vendor/auth",     require("./routes/vendor/authRoutes"));
app.use("/api/vendor/home",     require("./routes/vendor/homeRoutes"));
app.use("/api/vendor/products", require("./routes/vendor/productRoutes"));
app.use("/api/vendor/cart",     require("./routes/vendor/cartRoutes"));
app.use("/api/vendor/payments", require("./routes/vendor/paymentRoutes"));
app.use("/api/vendor/orders",   require("./routes/vendor/orderRoutes"));
app.use("/api/vendor/notifications", require("./routes/vendor/notificationRoutes"));

// ── Delivery ──────────────────────────────────────────────────
app.use("/api/delivery/auth",     require("./routes/delivery/authRoutes"));
app.use("/api/delivery/home",     require("./routes/delivery/homeRoutes"));
app.use("/api/delivery/tasks",    require("./routes/delivery/taskRoutes"));
app.use("/api/delivery/notifications", require("./routes/delivery/notificationRoutes"));

// profile, history, and dashboard all live in profileRoutes
app.use("/api/delivery",          require("./routes/delivery/profileRoutes"));

// ── Common ────────────────────────────────────────────────────
app.use("/api/location", require("./routes/common/locationRoutes"));

// ─── Root ──────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({
    message: "APOM Farmer API is running",
    docs:    "/api-docs",
    version: "1.0.0",
  });
});

// ─── Global Error Handler ──────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

module.exports = app;