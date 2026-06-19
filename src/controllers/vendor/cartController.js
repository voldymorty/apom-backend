const db = require("../../models");
const { getAvailableStock } = require("../../utils/inventoryHelper");
const {
  buildCartResponse,
  computeOrderTotals,
  formatDeliveryAddress,
} = require("../../utils/orderHelper");
const { Op } = require("sequelize");

async function getVendorCart(userId) {
  const vendor = await db.Vendor.findOne({ where: { user_id: userId } });
  if (!vendor) return null;

  let cart = [];
  try {
    const raw = vendor.cart_items;
    if (Array.isArray(raw)) {
      cart = raw;
    } else if (typeof raw === "string" && raw.trim()) {
      cart = JSON.parse(raw);
    }
    if (!Array.isArray(cart)) cart = [];
  } catch {
    cart = [];
  }

  return { vendor, cart };
}

async function validateCartItemStock(item, requestedQty) {
  const pricing = await db.Pricing.findOne({
    where: { pricing_id: item.pricing_id, product_id: item.product_id, is_active: true },
  });
  if (!pricing) {
    throw new Error(`Pricing not found for ${item.product_name || "item"}`);
  }

  const grade = item.grade || pricing.grade;
  const minOrder = parseFloat(pricing.minimum_order_kg || 0);
  const qty = parseFloat(requestedQty);

  if (qty < minOrder) {
    throw new Error(`Minimum order for grade ${grade} is ${minOrder} kg`);
  }

  const available = await getAvailableStock(item.product_id, grade);
  if (qty > available) {
    throw new Error(
      `Only ${available.toFixed(2)} kg available for ${item.product_name} (Grade ${grade})`
    );
  }

  return { grade, minOrder, available };
}

async function enrichCartItems(cart) {
  if (!cart.length) return [];

  const pricingIds = [...new Set(cart.map((i) => i.pricing_id))];
  const pricingRows = await db.Pricing.findAll({
    where: { pricing_id: pricingIds, is_active: true },
  });
  const pricingMap = new Map(pricingRows.map((p) => [p.pricing_id, p]));

  const inventoryRows = await db.Inventory.findAll({
    where: {
      [Op.or]: cart.map((i) => ({ product_id: i.product_id, grade: i.grade })),
    },
  });
  const inventoryMap = new Map(
    inventoryRows.map((inv) => [`${inv.product_id}::${inv.grade}`, inv])
  );

  return cart.map((item) => {
    const pricing = pricingMap.get(item.pricing_id);
    const inventory = inventoryMap.get(`${item.product_id}::${item.grade}`);

    const is_unavailable = !pricing;
    const current_price_per_unit = pricing
      ? parseFloat(pricing.wholesale_price_per_kg)
      : null;

    const storedPrice = parseFloat(item.price_per_unit || 0);
    const price_changed =
      current_price_per_unit !== null &&
      Math.abs(current_price_per_unit - storedPrice) > 0.001;

    let current_available_kg = null;
    if (inventory) {
      const available = parseFloat(inventory.available_quantity_kg || 0);
      const reserved = parseFloat(inventory.reserved_quantity_kg || 0);
      current_available_kg = Math.max(0, available - reserved);
    }

    const is_out_of_stock = current_available_kg !== null && current_available_kg <= 0;
    const insufficient_stock =
      current_available_kg !== null &&
      current_available_kg > 0 &&
      item.quantity > current_available_kg;

    const minimum_order_kg = pricing ? parseFloat(pricing.minimum_order_kg || 0) : null;
    const below_minimum_order =
      minimum_order_kg !== null && item.quantity < minimum_order_kg;

    const effective_price_per_unit = is_unavailable ? storedPrice : current_price_per_unit;
    const effective_total_price = parseFloat(
      (effective_price_per_unit * item.quantity).toFixed(2)
    );

    return {
      ...item,
      current_price_per_unit,
      price_changed,
      current_available_kg,
      is_out_of_stock,
      insufficient_stock,
      is_unavailable,
      below_minimum_order,
      minimum_order_kg: minimum_order_kg ?? item.minimum_order_kg,
      effective_price_per_unit,
      effective_total_price,
      has_issue: is_unavailable || is_out_of_stock || insufficient_stock || below_minimum_order,
    };
  });
}

exports.getVendorCart = getVendorCart;

exports.getCart = async (req, res) => {
  try {
    const result = await getVendorCart(req.user.user_id);
    if (!result) return res.status(404).json({ success: false, message: "Vendor not found" });

    const enrichedCart = await enrichCartItems(result.cart);

    return res.json({
      success: true,
      data: buildCartResponse(enrichedCart),
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.addToCart = async (req, res) => {
  try {
    const { product_id, pricing_id, quantity = 1 } = req.body;

    if (!product_id || !pricing_id) {
      return res.status(400).json({ success: false, message: "product_id and pricing_id are required" });
    }

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      return res.status(400).json({ success: false, message: "Quantity must be greater than 0" });
    }

    const pricing = await db.Pricing.findOne({
      where: { pricing_id, product_id, is_active: true },
      include: [{ model: db.Product, as: "product", attributes: ["product_name", "image_url", "unit"] }],
    });

    if (!pricing) {
      return res.status(404).json({ success: false, message: "Product or pricing not found" });
    }

    const minOrder = parseFloat(pricing.minimum_order_kg || 0);
    if (qty < minOrder) {
      return res.status(400).json({
        success: false,
        message: `Minimum order for grade ${pricing.grade} is ${minOrder} kg`,
      });
    }

    const available = await getAvailableStock(parseInt(product_id), pricing.grade);

    const result = await getVendorCart(req.user.user_id);
    if (!result) return res.status(404).json({ success: false, message: "Vendor not found" });

    const { vendor, cart } = result;
    const cartKey = `${product_id}_${pricing_id}`;
    const existingIdx = cart.findIndex((i) => i.cart_key === cartKey);
    const newQty = existingIdx >= 0 ? cart[existingIdx].quantity + qty : qty;

    if (available <= 0) {
      return res.status(400).json({
        success: false,
        message: `Grade ${pricing.grade} is currently out of stock`,
      });
    }

    if (newQty > available) {
      return res.status(400).json({
        success: false,
        message: `Only ${available.toFixed(2)} kg available for grade ${pricing.grade}`,
      });
    }

    if (existingIdx >= 0) {
      cart[existingIdx].quantity = newQty;
      cart[existingIdx].total_price = parseFloat(
        (newQty * cart[existingIdx].price_per_unit).toFixed(2)
      );
    } else {
      cart.push({
        cart_key: cartKey,
        product_id: parseInt(product_id),
        pricing_id: parseInt(pricing_id),
        product_name: pricing.product.product_name,
        image_url: pricing.product.image_url,
        unit: pricing.product.unit,
        grade: pricing.grade,
        price_per_unit: parseFloat(pricing.wholesale_price_per_kg),
        quantity: qty,
        total_price: parseFloat((qty * parseFloat(pricing.wholesale_price_per_kg)).toFixed(2)),
        minimum_order_kg: minOrder,
        available_kg: available,
      });
    }

    await db.Vendor.update({ cart_items: cart }, { where: { vendor_id: vendor.vendor_id } });

    return res.json({
      success: true,
      message: "Item added to cart",
      data: buildCartResponse(cart),
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateCartItem = async (req, res) => {
  try {
    const { cart_key, quantity } = req.body;

    if (!cart_key) {
      return res.status(400).json({ success: false, message: "cart_key is required" });
    }

    const result = await getVendorCart(req.user.user_id);
    if (!result) return res.status(404).json({ success: false, message: "Vendor not found" });

    const { vendor, cart } = result;
    const qty = parseFloat(quantity);
    const item = cart.find((i) => i.cart_key === cart_key);

    if (!item) {
      return res.status(404).json({ success: false, message: "Cart item not found" });
    }

    let updatedCart;
    if (isNaN(qty) || qty <= 0) {
      updatedCart = cart.filter((i) => i.cart_key !== cart_key);
    } else {
      await validateCartItemStock(item, qty);
      updatedCart = cart.map((i) => {
        if (i.cart_key !== cart_key) return i;
        return {
          ...i,
          quantity: qty,
          total_price: parseFloat((qty * i.price_per_unit).toFixed(2)),
        };
      });
    }

    await db.Vendor.update({ cart_items: updatedCart }, { where: { vendor_id: vendor.vendor_id } });

    return res.json({
      success: true,
      message: "Cart updated",
      data: buildCartResponse(updatedCart),
    });
  } catch (err) {
    const status = err.message.includes("Minimum order") || err.message.includes("available") ? 400 : 500;
    return res.status(status).json({ success: false, message: err.message });
  }
};

exports.removeCartItem = async (req, res) => {
  try {
    const { cart_key } = req.params;

    const result = await getVendorCart(req.user.user_id);
    if (!result) return res.status(404).json({ success: false, message: "Vendor not found" });

    const { vendor, cart } = result;
    const updatedCart = cart.filter((i) => i.cart_key !== cart_key);

    await db.Vendor.update({ cart_items: updatedCart }, { where: { vendor_id: vendor.vendor_id } });

    return res.json({
      success: true,
      message: "Item removed from cart",
      data: buildCartResponse(updatedCart),
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.clearCart = async (req, res) => {
  try {
    const result = await getVendorCart(req.user.user_id);
    if (!result) return res.status(404).json({ success: false, message: "Vendor not found" });

    await db.Vendor.update({ cart_items: [] }, { where: { vendor_id: result.vendor.vendor_id } });

    return res.json({
      success: true,
      message: "Cart cleared",
      data: buildCartResponse([]),
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

/** Legacy direct checkout — prefer POST /vendor/payments/initiate for Razorpay flow */
exports.checkout = async (req, res) => {
  try {
    const { delivery_address, delivery_address_id, special_instructions } = req.body;

    if (!delivery_address?.trim()) {
      return res.status(400).json({ success: false, message: "Delivery address is required" });
    }

    const result = await getVendorCart(req.user.user_id);
    if (!result) return res.status(404).json({ success: false, message: "Vendor not found" });

    const { vendor, cart } = result;
    if (!cart || cart.length === 0) {
      return res.status(400).json({ success: false, message: "Cart is empty" });
    }

    for (const item of cart) {
      await validateCartItemStock(item, item.quantity);
    }

    let validatedAddressId = null;
    if (delivery_address_id) {
      const addressExists = await db.VendorAddress.findOne({
        where: { address_id: delivery_address_id, vendor_id: vendor.vendor_id },
      });
      validatedAddressId = addressExists ? delivery_address_id : null;
    }

    const totals = computeOrderTotals(cart);
    const order_number = `ORD-${Date.now()}-${vendor.vendor_id}`;

    const order = await db.Order.create({
      order_number,
      vendor_id: vendor.vendor_id,
      subtotal_amount: totals.subtotal,
      tax_percentage: totals.tax_percentage,
      tax_amount: totals.tax,
      delivery_charges: totals.delivery_charges,
      final_amount: totals.final_amount,
      order_status: "placed",
      payment_status: "pending",
      delivery_address: delivery_address.trim(),
      delivery_address_id: validatedAddressId,
      special_instructions: special_instructions || null,
      expected_delivery_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    });

    await db.OrderItem.bulkCreate(
      cart.map((item) => ({
        order_id: order.order_id,
        product_id: item.product_id,
        grade: item.grade,
        quantity_kg: item.quantity,
        price_per_kg: item.price_per_unit,
        total_price: item.total_price,
        status: "pending",
      }))
    );

    await db.Vendor.update(
      { cart_items: [], total_orders: (vendor.total_orders || 0) + 1 },
      { where: { vendor_id: vendor.vendor_id } }
    );

    // ── Notify vendor: order placed ──
    const { sendNotification } = require("../../utils/notificationService");
    sendNotification({
      userId: req.user.user_id,
      type: "order",
      title: "📦 Order Placed!",
      message: `Order #${order.order_number} placed successfully.`,
      referenceType: "order",
      referenceId: order.order_id,
      priority: "high",
      fcmData: { screen: "order_detail", order_id: String(order.order_id) },
    }).catch((err) => console.error("Notification error:", err));

    return res.status(201).json({
      success: true,
      message: "Order placed successfully",
      data: {
        order_id: order.order_id,
        order_number: order.order_number,
        final_amount: order.final_amount,
        order_status: order.order_status,
        expected_delivery_date: order.expected_delivery_date,
      },
    });
  } catch (err) {
    const status = err.message.includes("available") || err.message.includes("Minimum") ? 400 : 500;
    return res.status(status).json({ success: false, message: err.message });
  }
};
