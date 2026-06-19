const DELIVERY_CHARGE = 15.0;
const TAX_RATE = 0.05;

function buildCartResponse(cart) {
  const subtotal = cart.reduce(
    (sum, i) => sum + (i.effective_total_price ?? i.total_price ?? 0),
    0
  );
  const tax = parseFloat((subtotal * TAX_RATE).toFixed(2));
  const grand_total = parseFloat((subtotal + DELIVERY_CHARGE + tax).toFixed(2));

  return {
    items: cart,
    item_count: cart.length,
    summary: {
      subtotal: parseFloat(subtotal.toFixed(2)),
      delivery_charges: DELIVERY_CHARGE,
      tax_rate: TAX_RATE * 100,
      tax_amount: tax,
      grand_total,
    },
  };
}

function computeOrderTotals(cart) {
  const subtotal = cart.reduce((sum, i) => sum + (i.total_price || 0), 0);
  const tax = parseFloat((subtotal * TAX_RATE).toFixed(2));
  const final_amount = parseFloat((subtotal + DELIVERY_CHARGE + tax).toFixed(2));
  return {
    subtotal: parseFloat(subtotal.toFixed(2)),
    tax,
    tax_percentage: TAX_RATE * 100,
    delivery_charges: DELIVERY_CHARGE,
    final_amount,
  };
}

function formatDeliveryAddress(addressRow) {
  if (!addressRow) return "";
  const parts = [
    addressRow.address_line1,
    addressRow.address_line2,
    addressRow.landmark ? `Landmark: ${addressRow.landmark}` : null,
    [addressRow.city, addressRow.state].filter(Boolean).join(", "),
    addressRow.pincode,
  ].filter(Boolean);
  return parts.join("\n");
}

module.exports = {
  DELIVERY_CHARGE,
  TAX_RATE,
  buildCartResponse,
  computeOrderTotals,
  formatDeliveryAddress,
};
