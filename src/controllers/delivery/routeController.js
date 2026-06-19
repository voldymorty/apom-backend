const db = require("../../models");
const { Op } = require("sequelize");

// ─── Helper ──────────────────────────────────────────────────────────────────
const getDeliveryPerson = (user_id) =>
  db.DeliveryPersonnel.findOne({ where: { user_id } });

// Shared task include — used in every route response so the Flutter task cards
// get all the data they need (farmer/vendor name, contact, crop, order).
const taskInclude = [
  {
    model: db.Farmer,
    as: "farmer",
    attributes: ["full_name", "location_address"],
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
      { model: db.Product, as: "product", attributes: ["product_name", "unit"] },
    ],
  },
  {
    model: db.Order,
    as: "order",
    attributes: ["order_number", "order_status"],
  },
];

// ─── GET /delivery/routes ─────────────────────────────────────────────────────
// Query: date (YYYY-MM-DD, default today), status
// Returns route plans with embedded task stops for the given day.
exports.getRoutes = async (req, res) => {
  try {
    const dp = await getDeliveryPerson(req.user.user_id);
    if (!dp)
      return res.status(404).json({ success: false, message: "Delivery profile not found" });

    const { date = new Date().toISOString().split("T")[0], status } = req.query;

    const where = {
      delivery_person_id: dp.delivery_person_id,
      route_date:         date,
    };
    if (status) where.status = status;

    const routes = await db.DeliveryRoute.findAll({
      where,
      order: [["created_at", "ASC"]],
    });

    // Attach tasks (stops) for each route
    const enriched = await Promise.all(
      routes.map(async (route) => {
        const tasks = await db.PickupDelivery.findAll({
          where: {
            delivery_person_id: dp.delivery_person_id,
            scheduled_date:     date,
          },
          include: taskInclude,
          order: [
            ["scheduled_time_slot", "ASC"],
            ["delivery_type",       "ASC"], // pickups before deliveries in same slot
          ],
        });

        const taskSummary = {
          total:     tasks.length,
          pickups:   tasks.filter((t) => t.delivery_type === "pickup").length,
          deliveries: tasks.filter((t) => t.delivery_type === "delivery").length,
          completed: tasks.filter((t) => t.status === "completed").length,
          pending:   tasks.filter((t) => !["completed", "failed", "cancelled"].includes(t.status)).length,
        };

        return { ...route.toJSON(), task_summary: taskSummary, tasks };
      })
    );

    return res.json({
      success: true,
      data:    enriched,
      total:   enriched.length,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── GET /delivery/routes/:route_id ───────────────────────────────────────────
// Full route detail with all stops and optimised waypoints
exports.getRouteById = async (req, res) => {
  try {
    const dp = await getDeliveryPerson(req.user.user_id);
    if (!dp)
      return res.status(404).json({ success: false, message: "Delivery profile not found" });

    const route = await db.DeliveryRoute.findOne({
      where: {
        route_id:           req.params.route_id,
        delivery_person_id: dp.delivery_person_id,
      },
    });
    if (!route)
      return res.status(404).json({ success: false, message: "Route not found" });

    const tasks = await db.PickupDelivery.findAll({
      where: {
        delivery_person_id: dp.delivery_person_id,
        scheduled_date:     route.route_date,
      },
      include: taskInclude,
      order: [
        ["scheduled_time_slot", "ASC"],
        ["delivery_type",       "ASC"],
      ],
    });

    const taskSummary = {
      total:      tasks.length,
      pickups:    tasks.filter((t) => t.delivery_type === "pickup").length,
      deliveries: tasks.filter((t) => t.delivery_type === "delivery").length,
      completed:  tasks.filter((t) => t.status === "completed").length,
      failed:     tasks.filter((t) => t.status === "failed").length,
      pending:    tasks.filter((t) => !["completed", "failed", "cancelled"].includes(t.status)).length,
    };

    return res.json({
      success: true,
      data: {
        ...route.toJSON(),
        task_summary: taskSummary,
        tasks,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── PATCH /delivery/routes/:route_id/start ───────────────────────────────────
// Driver taps "Start Route" — stamps start_time, sets status to in_progress
exports.startRoute = async (req, res) => {
  try {
    const dp = await getDeliveryPerson(req.user.user_id);
    if (!dp)
      return res.status(404).json({ success: false, message: "Delivery profile not found" });

    const route = await db.DeliveryRoute.findOne({
      where: {
        route_id:           req.params.route_id,
        delivery_person_id: dp.delivery_person_id,
        status:             "planned",
      },
    });
    if (!route)
      return res
        .status(404)
        .json({ success: false, message: "Route not found or already started" });

    await route.update({ status: "in_progress", start_time: new Date() });

    // Mark driver as busy
    await dp.update({ is_available: false });

    return res.json({
      success: true,
      message: "Route started successfully",
      data:    route,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── PATCH /delivery/routes/:route_id/complete ────────────────────────────────
// Called when driver finishes all stops or manually closes the route
exports.completeRoute = async (req, res) => {
  try {
    const dp = await getDeliveryPerson(req.user.user_id);
    if (!dp)
      return res.status(404).json({ success: false, message: "Delivery profile not found" });

    const route = await db.DeliveryRoute.findOne({
      where: {
        route_id:           req.params.route_id,
        delivery_person_id: dp.delivery_person_id,
        status:             "in_progress",
      },
    });
    if (!route)
      return res
        .status(404)
        .json({ success: false, message: "Route not found or not in progress" });

    // Recount completed stops from actual task data
    const completedStops = await db.PickupDelivery.count({
      where: {
        delivery_person_id: dp.delivery_person_id,
        scheduled_date:     route.route_date,
        status:             "completed",
      },
    });

    await route.update({
      status:          "completed",
      end_time:        new Date(),
      completed_stops: completedStops,
    });

    // Free up the driver
    await dp.update({ is_available: true });

    return res.json({
      success: true,
      message: "Route completed successfully",
      data:    route,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── PATCH /delivery/routes/:route_id/cancel ─────────────────────────────────
// Admin or driver cancels a planned route
exports.cancelRoute = async (req, res) => {
  try {
    const dp = await getDeliveryPerson(req.user.user_id);
    if (!dp)
      return res.status(404).json({ success: false, message: "Delivery profile not found" });

    const route = await db.DeliveryRoute.findOne({
      where: {
        route_id:           req.params.route_id,
        delivery_person_id: dp.delivery_person_id,
        status:             { [Op.in]: ["planned", "in_progress"] },
      },
    });
    if (!route)
      return res
        .status(404)
        .json({ success: false, message: "Route not found or already completed/cancelled" });

    await route.update({ status: "cancelled", end_time: new Date() });

    // Free up the driver if the route was in progress
    if (!dp.is_available) await dp.update({ is_available: true });

    return res.json({
      success: true,
      message: "Route cancelled",
      data:    route,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};