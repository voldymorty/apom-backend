const db = require("../models");

/**
 * Get available stock for a product+grade (available minus reserved).
 */
async function getAvailableStock(productId, grade, transaction) {
  const inventory = await db.Inventory.findOne({
    where: { product_id: productId, grade },
    transaction,
    lock: transaction ? transaction.LOCK.UPDATE : undefined,
  });
  if (!inventory) return 0;
  const available = parseFloat(inventory.available_quantity_kg || 0);
  const reserved = parseFloat(inventory.reserved_quantity_kg || 0);
  return Math.max(0, available - reserved);
}

/**
 * Reserve stock for an order item. Throws if insufficient.
 */
async function reserveStock({ productId, grade, quantityKg, orderId, userId, transaction }) {
  const inventory = await db.Inventory.findOne({
    where: { product_id: productId, grade },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });

  if (!inventory) {
    throw new Error(`No inventory for product ${productId} grade ${grade}`);
  }

  const available = parseFloat(inventory.available_quantity_kg || 0);
  const reserved = parseFloat(inventory.reserved_quantity_kg || 0);
  const netAvailable = available - reserved;

  if (quantityKg > netAvailable) {
    throw new Error(
      `Insufficient stock for grade ${grade}: only ${netAvailable.toFixed(2)} kg available`
    );
  }

  const newReserved = parseFloat((reserved + quantityKg).toFixed(3));
  await inventory.update({ reserved_quantity_kg: newReserved }, { transaction });

  await db.InventoryTransaction.create(
    {
      inventory_id: inventory.inventory_id,
      transaction_type: "stock_out",
      quantity_kg: quantityKg,
      previous_quantity: available,
      new_quantity: available,
      reference_type: "order",
      reference_id: orderId,
      remarks: `Reserved ${quantityKg} kg for order #${orderId}`,
      performed_by: userId || null,
    },
    { transaction }
  );

  return inventory;
}

/**
 * Release reserved stock (order cancel / payment failure).
 */
async function releaseStock({ productId, grade, quantityKg, orderId, userId, transaction }) {
  const inventory = await db.Inventory.findOne({
    where: { product_id: productId, grade },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });

  if (!inventory) return;

  const available = parseFloat(inventory.available_quantity_kg || 0);
  const reserved = parseFloat(inventory.reserved_quantity_kg || 0);
  const releaseQty = Math.min(quantityKg, reserved);
  const newReserved = parseFloat(Math.max(0, reserved - releaseQty).toFixed(3));

  await inventory.update({ reserved_quantity_kg: newReserved }, { transaction });

  await db.InventoryTransaction.create(
    {
      inventory_id: inventory.inventory_id,
      transaction_type: "return",
      quantity_kg: releaseQty,
      previous_quantity: available,
      new_quantity: available,
      reference_type: "order",
      reference_id: orderId,
      remarks: `Released ${releaseQty} kg reserved stock for order #${orderId}`,
      performed_by: userId || null,
    },
    { transaction }
  );
}

module.exports = {
  getAvailableStock,
  reserveStock,
  releaseStock,
};
