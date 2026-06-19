const db = require("../models");
const { releaseStock } = require("./inventoryHelper");

/**
 * Releases reserved stock for an order and marks it failed/cancelled.
 * Caller must hold a row lock on `order` within `transaction`.
 * Returns false if the order was already paid (no-op).
 */
async function releaseOrderReservation({ order, userId, reason, transaction }) {
  if (order.payment_status === "paid") {
    return false;
  }

  for (const item of order.items || []) {
    await releaseStock({
      productId: item.product_id,
      grade: item.grade,
      quantityKg: parseFloat(item.quantity_kg),
      orderId: order.order_id,
      userId,
      transaction,
    });
  }

  await db.Payment.update(
    { payment_status: "failed", failure_reason: reason },
    { where: { order_id: order.order_id }, transaction }
  );

  await order.update(
    { payment_status: "failed", order_status: "cancelled" },
    { transaction }
  );

  return true;
}

module.exports = { releaseOrderReservation };