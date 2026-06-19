const db = require("../../models");
const { Op } = require("sequelize");

// ─── Helper ──────────────────────────────────────────────────────────────────
const getDeliveryPerson = (user_id) =>
  db.DeliveryPersonnel.findOne({ where: { user_id } });

// ─── PATCH /delivery/location ─────────────────────────────────────────────────
// Body: { latitude, longitude, delivery_id? }
// Called periodically by the Flutter app while driver is on a task
exports.updateLocation = async (req, res) => {
  try {
    const dp = await getDeliveryPerson(req.user.user_id);
    if (!dp)
      return res.status(404).json({ success: false, message: "Delivery profile not found" });

    const { latitude, longitude, delivery_id } = req.body;

    if (latitude === undefined || longitude === undefined)
      return res.status(400).json({ success: false, message: "latitude and longitude are required" });

    const now = new Date();

    // Update driver's current position on delivery_personnel
    await dp.update({
      current_latitude:     latitude,
      current_longitude:    longitude,
      last_location_update: now,
    });

    // If an active delivery_id is provided, stamp a tracking ping in status history
    if (delivery_id) {
      const task = await db.PickupDelivery.findOne({
        where: {
          delivery_id,
          delivery_person_id: dp.delivery_person_id,
          status: { [Op.in]: ["accepted", "in_transit", "reached"] },
        },
      });

      if (task) {
        await db.DeliveryStatusHistory.create({
          delivery_id: task.delivery_id,
          old_status:  task.status,
          new_status:  task.status, // same status — just a GPS ping
          changed_by:  req.user.user_id,
          latitude,
          longitude,
          remarks: "location_update",
        });
      }
    }

    return res.json({
      success: true,
      message: "Location updated",
      data: {
        current_latitude:     latitude,
        current_longitude:    longitude,
        last_location_update: now,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── GET /delivery/location ───────────────────────────────────────────────────
// Returns the driver's last known position
exports.getLocation = async (req, res) => {
  try {
    const dp = await getDeliveryPerson(req.user.user_id);
    if (!dp)
      return res.status(404).json({ success: false, message: "Delivery profile not found" });

    return res.json({
      success: true,
      data: {
        current_latitude:     dp.current_latitude,
        current_longitude:    dp.current_longitude,
        last_location_update: dp.last_location_update,
        is_available:         dp.is_available,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─── GET /delivery/location/history/:delivery_id ──────────────────────────────
// Returns full GPS trail for a specific task (for admin map replay)
exports.getLocationHistory = async (req, res) => {
  try {
    const dp = await getDeliveryPerson(req.user.user_id);
    if (!dp)
      return res.status(404).json({ success: false, message: "Delivery profile not found" });

    // Verify the task belongs to this driver
    const task = await db.PickupDelivery.findOne({
      where: {
        delivery_id:        req.params.delivery_id,
        delivery_person_id: dp.delivery_person_id,
      },
    });
    if (!task)
      return res.status(404).json({ success: false, message: "Task not found" });

    const trail = await db.DeliveryStatusHistory.findAll({
      where: {
        delivery_id: req.params.delivery_id,
        remarks:     "location_update",
        latitude:    { [Op.ne]: null },
        longitude:   { [Op.ne]: null },
      },
      attributes: ["latitude", "longitude", "created_at"],
      order: [["created_at", "ASC"]],
    });

    return res.json({
      success: true,
      data:    trail,
      total:   trail.length,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};