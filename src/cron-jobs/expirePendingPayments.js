const cron = require("node-cron");
const { Op } = require("sequelize");
const db = require("../models");
const { releaseOrderReservation } = require("../utils/paymentExpiryHelper");

const RESERVATION_TTL_MINUTES = 15;
let isRunning = false;

async function expirePendingPayments() {
  if (isRunning) return; // avoid overlapping runs
  isRunning = true;

  try {
    const cutoff = new Date(Date.now() - RESERVATION_TTL_MINUTES * 60 * 1000);

    const candidates = await db.Order.findAll({
      where: {
        payment_status: "pending",
        order_status: { [Op.ne]: "cancelled" },
        created_at: { [Op.lte]: cutoff },
      },
      attributes: ["order_id"],
    });

    for (const { order_id } of candidates) {
      const t = await db.sequelize.transaction();
      try {
        const order = await db.Order.findOne({
          where: { order_id },
          include: [{ model: db.OrderItem, as: "items" }],
          transaction: t,
          lock: t.LOCK.UPDATE,
        });

        if (!order || order.payment_status !== "pending") {
          await t.commit();
          continue;
        }

        await releaseOrderReservation({
          order,
          userId: null,
          reason: "Payment session expired (auto-released)",
          transaction: t,
        });

        await t.commit();
        console.log(`[expirePendingPayments] released reservation for order ${order_id}`);
      } catch (err) {
        if (!t.finished) await t.rollback();
        console.error(`[expirePendingPayments] failed for order ${order_id}:`, err);
      }
    }
  } finally {
    isRunning = false;
  }
}

function startExpiryCron() {
  // every 5 minutes is plenty given a 15-minute TTL
  cron.schedule("*/5 * * * *", () => {
    expirePendingPayments().catch((err) =>
      console.error("[expirePendingPayments] run failed:", err)
    );
  });
}

module.exports = { startExpiryCron, expirePendingPayments };