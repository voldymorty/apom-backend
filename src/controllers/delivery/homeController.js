// src/controllers/delivery/homeController.js 
const db = require("../../models");
const { Op } = require("sequelize");
  const moment = require("moment");

// ─── Helper ─────────────────────────────────────────────────────────────────
const getDeliveryPerson = (user_id) =>
  db.DeliveryPersonnel.findOne({ where: { user_id } });

// ─── GET /delivery/home ─────────────────────────────────────────────────────
// Returns today's pickup/delivery stats + next pending task
  exports.getHome = async (req, res) => {
      try {
        const dp = await getDeliveryPerson(req.user.user_id);
        if (!dp)
          return res.status(404).json({ success: false, message: "Delivery profile not found" });

        const today = new Date().toISOString().split("T")[0];

        const [totalPickups, completedPickups, totalDeliveries, completedDeliveries] =
          await Promise.all([
            db.PickupDelivery.count({
              where: { delivery_person_id: dp.delivery_person_id, delivery_type: "pickup", scheduled_date: today },
            }),
            db.PickupDelivery.count({
              where: { delivery_person_id: dp.delivery_person_id, delivery_type: "pickup", scheduled_date: today, status: "completed" },
            }),
            db.PickupDelivery.count({
              where: { delivery_person_id: dp.delivery_person_id, delivery_type: "delivery", scheduled_date: today },
            }),
            db.PickupDelivery.count({
              where: { delivery_person_id: dp.delivery_person_id, delivery_type: "delivery", scheduled_date: today, status: "completed" },
            }),
          ]);

        // Next pending task — pickups before deliveries
        const nextTask = await db.PickupDelivery.findOne({
          where: {
            delivery_person_id: dp.delivery_person_id,
            scheduled_date: today,
            status: { [Op.in]: ["assigned", "accepted", "in_transit", "reached"] },
          },
          include: [
            { model: db.Farmer, as: "farmer", attributes: ["full_name", "location_address"] },
            { model: db.Vendor, as: "vendor", attributes: ["shop_name", "owner_name"], required: false },
            {
              model: db.FarmerCrop,
              as: "crop",
              include: [{ model: db.Product, as: "product", attributes: ["product_name"] }],
            },
          ],
          order: [
            ["delivery_type", "ASC"],
            ["scheduled_time_slot", "ASC"],
          ],
        });

        let nextTaskJson = null;
        if (nextTask) {
          nextTaskJson = nextTask.toJSON();
          if (nextTaskJson.delivery_type === "delivery" && nextTaskJson.order_id) {
            const orderItems = await db.OrderItem.findAll({
              where: { order_id: nextTaskJson.order_id },
              include: [{ model: db.Product, as: "product" }],
            });
            nextTaskJson.crop = {
              crop_id: 0,
              quantity_kg: nextTaskJson.expected_quantity_kg,
              product: {
                product_name: orderItems
                  .map((item) => `${item.product?.product_name || "Product"} (${item.quantity_kg}kg)`)
                  .join(", "),
              },
            };
          }
        }

        return res.json({
          success: true,
          data: {
            delivery_person: {
              full_name: dp.full_name,
              vehicle_number: dp.vehicle_number,
              vehicle_type: dp.vehicle_type,
              rating: dp.rating,
              profile_photo_url: dp.profile_photo_url,
              is_available: dp.is_available,
            },
            today_stats: {
              pickups:    { completed: completedPickups,    total: totalPickups },
              deliveries: { completed: completedDeliveries, total: totalDeliveries },
            },
            next_task: nextTaskJson,
          },
        });
      } catch (err) {
      console.error("HOME ERROR:", err); // Add this
      return res.status(500).json({ success: false, message: err.message });
    }
  };

  exports.getDashboardSummary = async (req, res) => {
    try {
      const dp = await getDeliveryPerson(req.user.user_id);
      if (!dp) {
        return res.status(404).json({
          success: false,
          message: "Delivery profile not found",
        });
      }

      const today = new Date();
      const todayStr = today.toISOString().split("T")[0];

      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);

      // const firstDay = moment().startOf("month").format("YYYY-MM-DD");
      // const lastDay = moment().endOf("month").format("YYYY-MM-DD");

      const validStatuses = {
        [Op.notIn]: ["failed", "cancelled"],
      };      

      const [
        completedPickups,
        completedDeliveries,
        inProgressPickups,
        inProgressDeliveries,
        pendingPickups,
        pendingDeliveries,
        upcomingPickups,
        upcomingDeliveries,
      ] = await Promise.all([

        // ✅ COMPLETED
        db.PickupDelivery.count({
          where: {
            delivery_person_id: dp.delivery_person_id,
            status: "completed",
            delivery_type: "pickup",
            scheduled_date: { [Op.between]: [firstDay, lastDay] },
          },
        }),
        db.PickupDelivery.count({
          where: {
            delivery_person_id: dp.delivery_person_id,
            status: "completed",
            delivery_type: "delivery",
            scheduled_date: { [Op.between]: [firstDay, lastDay] },
          },
        }),

        // ✅ IN PROGRESS
        db.PickupDelivery.count({
          where: {
            delivery_person_id: dp.delivery_person_id,
            delivery_type: "pickup",
            status: { [Op.in]: ["accepted", "in_transit", "reached"] },
            scheduled_date: { [Op.lte]: todayStr },
          },
        }),
        db.PickupDelivery.count({
          where: {
            delivery_person_id: dp.delivery_person_id,
            delivery_type: "delivery",
            status: { [Op.in]: ["accepted", "in_transit", "reached"] },
            scheduled_date: { [Op.lte]: todayStr },
          },
        }),

        // ✅ PENDING
        db.PickupDelivery.count({
          where: {
            delivery_person_id: dp.delivery_person_id,
            delivery_type: "pickup",
            status: "assigned",
            scheduled_date: { [Op.lte]: todayStr },
          },
        }),
        db.PickupDelivery.count({
          where: {
            delivery_person_id: dp.delivery_person_id,
            delivery_type: "delivery",
            status: "assigned",
            scheduled_date: { [Op.lte]: todayStr },
          },
        }),

        // ✅ UPCOMING
        db.PickupDelivery.count({
          where: {
            delivery_person_id: dp.delivery_person_id,
            delivery_type: "pickup",
            status: "assigned",
            scheduled_date: {
              [Op.gt]: todayStr,
              [Op.lte]: lastDay,
            },
          },
        }),
        db.PickupDelivery.count({
          where: {
            delivery_person_id: dp.delivery_person_id,
            delivery_type: "delivery",
            status: "assigned",
            scheduled_date: {
              [Op.gt]: todayStr,
              [Op.lte]: lastDay,
            },
          },
        }),
      ]);

      return res.json({
        success: true,
        data: {
          completed: {
            total: completedPickups + completedDeliveries,
            pickups: completedPickups,
            deliveries: completedDeliveries,
          },
          in_progress: {
            total: inProgressPickups + inProgressDeliveries,
            pickups: inProgressPickups,
            deliveries: inProgressDeliveries,
          },
          pending: {
            total: pendingPickups + pendingDeliveries,
            pickups: pendingPickups,
            deliveries: pendingDeliveries,
          },
          upcoming: {
            total: upcomingPickups + upcomingDeliveries,
            pickups: upcomingPickups,
            deliveries: upcomingDeliveries,
          },
        },
      });
    } catch (err) {
      console.error("DASHBOARD SUMMARY ERROR:", err);
      return res.status(500).json({
        success: false,
        message: err.message,
      });
    }
  };

  exports.getWeeklyPerformance = async (req, res) => {
    try {
      const dp = await getDeliveryPerson(req.user.user_id);
      if (!dp) {
        return res.status(404).json({
          success: false,
          message: "Delivery profile not found",
        });
      }

      const today = moment().format("YYYY-MM-DD");

      const startOfWeekDate = moment().startOf("isoWeek").startOf("day").toDate();
      const endOfWeekDate = moment().endOf("isoWeek").endOf("day").toDate();

      const records = await db.PickupDelivery.findAll({
        where: {
          delivery_person_id: dp.delivery_person_id,
          status: "completed",
          completed_at: {
            [Op.gte]: startOfWeekDate,
            [Op.lte]: endOfWeekDate,
          },
        },
        attributes: ["delivery_type", "completed_at"],
        raw: true,
      });

      // ✅ Fixed order (Mon → Sun)
      const daysOrder = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

      const daysMap = {};
      daysOrder.forEach((day) => {
        daysMap[day] = { pickups: 0, deliveries: 0 };
      });

      records.forEach((r) => {
        const day = moment(r.completed_at).format("ddd");

        if (r.delivery_type === "pickup") {
          daysMap[day].pickups++;
        } else {
          daysMap[day].deliveries++;
        }
      });

      const result = daysOrder.map((day) => ({
        day,
        pickups: daysMap[day].pickups,
        deliveries: daysMap[day].deliveries,
      }));

      return res.json({
        success: true,
        data: result,
      });
    } catch (err) {
      console.error("WEEKLY PERFORMANCE ERROR:", err);
      return res.status(500).json({
        success: false,
        message: err.message,
      });
    }
  };