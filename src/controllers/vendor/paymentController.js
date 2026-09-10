const crypto = require("crypto");
const Razorpay = require("razorpay");
const db = require("../../models");
const { getVendorCart } = require("./cartController");
const { reserveStock, releaseStock } = require("../../utils/inventoryHelper");
const {
  computeOrderTotals,
  formatDeliveryAddress,
} = require("../../utils/orderHelper");

function getRazorpayClient() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error("Razorpay credentials are not configured on the server");
  }
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

async function validateCartForCheckout(cart) {
  if (!cart || cart.length === 0) {
    throw new Error("Cart is empty");
  }

  for (const item of cart) {
    const pricing = await db.Pricing.findOne({
      where: { pricing_id: item.pricing_id, product_id: item.product_id, is_active: true },
    });
    if (!pricing) {
      throw new Error(`Product pricing not found for ${item.product_name || "item"}`);
    }

    const grade = item.grade || pricing.grade;
    const minOrder = parseFloat(pricing.minimum_order_kg || 0);
    const qty = parseFloat(item.quantity);

    if (qty < minOrder) {
      throw new Error(`Minimum order for ${item.product_name} (Grade ${grade}) is ${minOrder} kg`);
    }

    const inventory = await db.Inventory.findOne({
      where: { product_id: item.product_id, grade },
    });
    if (!inventory) {
      throw new Error(`No inventory for ${item.product_name} Grade ${grade}`);
    }

    const available = parseFloat(inventory.available_quantity_kg || 0);
    const reserved = parseFloat(inventory.reserved_quantity_kg || 0);
    const netAvailable = available - reserved;

    if (netAvailable <= 0) {
      throw new Error(
        `${item.product_name} (Grade ${grade}) is currently out of stock`
      );
    }

    if (qty > netAvailable) {
      throw new Error(
        `Only ${netAvailable.toFixed(2)} kg available for ${item.product_name} (Grade ${grade})`
      );
    }

    item.grade = grade;
    item.price_per_unit = parseFloat(pricing.wholesale_price_per_kg);
    item.total_price = parseFloat((qty * item.price_per_unit).toFixed(2));
  }
}

async function cleanupFailedInitiation(orderId, vendorId, userId, reason) {
  const t = await db.sequelize.transaction();
  try {
    const order = await db.Order.findOne({
      where: { order_id: orderId, vendor_id: vendorId },
      include: [{ model: db.OrderItem, as: "items" }],
      transaction: t,
    });
    if (!order) {
      await t.commit();
      return;
    }

    for (const item of order.items || []) {
      await releaseStock({
        productId: item.product_id,
        grade: item.grade,
        quantityKg: parseFloat(item.quantity_kg),
        orderId: order.order_id,
        userId,
        transaction: t,
      });
    }

    await db.Payment.update(
      { payment_status: "failed", failure_reason: reason || "Razorpay order creation failed" },
      { where: { order_id: orderId }, transaction: t }
    );

    await order.update(
      { payment_status: "failed", order_status: "cancelled" },
      { transaction: t }
    );

    await t.commit();
  } catch (err) {
    if (!t.finished) await t.rollback();
    console.error("cleanupFailedInitiation error:", err);
  }
}

async function resolveDeliveryAddress(vendor, body) {
  const { delivery_address, delivery_address_id } = body;

  if (delivery_address_id) {
    const saved = await db.VendorAddress.findOne({
      where: { address_id: delivery_address_id, vendor_id: vendor.vendor_id, is_active: true },
    });
    if (saved) {
      return {
        delivery_address_id: saved.address_id,
        delivery_address: formatDeliveryAddress(saved),
        delivery_latitude: saved.latitude,
        delivery_longitude: saved.longitude,
      };
    }
  }

  if (delivery_address?.trim()) {
    return {
      delivery_address_id: delivery_address_id || null,
      delivery_address: delivery_address.trim(),
      delivery_latitude: null,
      delivery_longitude: null,
    };
  }

  const defaultAddress = await db.VendorAddress.findOne({
    where: { vendor_id: vendor.vendor_id, is_default: true, is_active: true },
  });
  if (defaultAddress) {
    return {
      delivery_address_id: defaultAddress.address_id,
      delivery_address: formatDeliveryAddress(defaultAddress),
      delivery_latitude: defaultAddress.latitude,
      delivery_longitude: defaultAddress.longitude,
    };
  }

  throw new Error("Delivery address is required");
}

/**
 * POST /vendor/payments/initiate
 * Creates order + reserves inventory + Razorpay order. Cart is cleared only after verify.
 */
exports.initiatePayment = async (req, res) => {
  const t = await db.sequelize.transaction();
  try {
    const result = await getVendorCart(req.user.user_id);
    if (!result) {
      await t.rollback();
      return res.status(404).json({ success: false, message: "Vendor not found" });
    }

    const { vendor, cart } = result;
    await validateCartForCheckout(cart);

    const addressInfo = await resolveDeliveryAddress(vendor, req.body);
    const totals = computeOrderTotals(cart);
    const order_number = `ORD-${Date.now()}-${vendor.vendor_id}`;

    const order = await db.Order.create(
      {
        order_number,
        vendor_id: vendor.vendor_id,
        subtotal_amount: totals.subtotal,
        tax_percentage: totals.tax_percentage,
        tax_amount: totals.tax,
        delivery_charges: totals.delivery_charges,
        final_amount: totals.final_amount,
        order_status: "placed",
        payment_status: "pending",
        delivery_address: addressInfo.delivery_address,
        delivery_address_id: addressInfo.delivery_address_id,
        delivery_latitude: addressInfo.delivery_latitude,
        delivery_longitude: addressInfo.delivery_longitude,
        special_instructions: req.body.special_instructions || null,
        expected_delivery_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      },
      { transaction: t }
    );

    for (const item of cart) {
      await db.OrderItem.create(
        {
          order_id: order.order_id,
          product_id: item.product_id,
          grade: item.grade,
          quantity_kg: item.quantity,
          price_per_kg: item.price_per_unit,
          total_price: item.total_price,
          status: "pending",
        },
        { transaction: t }
      );

      await reserveStock({
        productId: item.product_id,
        grade: item.grade,
        quantityKg: parseFloat(item.quantity),
        orderId: order.order_id,
        userId: req.user.user_id,
        transaction: t,
      });
    }

    const payment = await db.Payment.create(
      {
        order_id: order.order_id,
        vendor_id: vendor.vendor_id,
        payment_method: "razorpay",
        amount: totals.final_amount,
        payment_status: "initiated",
      },
      { transaction: t }
    );

    await t.commit();

    const razorpay = getRazorpayClient();
    const amountPaise = Math.round(parseFloat(totals.final_amount) * 100);

    let razorpayOrder;
    try {
      razorpayOrder = await razorpay.orders.create({
        amount: amountPaise,
        currency: "INR",
        receipt: order.order_number,
        notes: {
          order_id: String(order.order_id),
          vendor_id: String(vendor.vendor_id),
          payment_id: String(payment.payment_id),
        },
      });
    } catch (rzErr) {
      console.error("Razorpay Error:", rzErr);
      console.error("Response:", rzErr.error);

      await cleanupFailedInitiation(
        order.order_id,
        vendor.vendor_id,
        req.user.user_id,
        JSON.stringify(rzErr)
      );

      throw new Error(
        `Unable to create Razorpay order: ${
          rzErr.error?.description || rzErr.message || "Unknown Razorpay error"
        }`
      );
    }

    await db.Payment.update(
      { razorpay_order_id: razorpayOrder.id, payment_status: "pending" },
      { where: { payment_id: payment.payment_id } }
    );

    return res.status(201).json({
      success: true,
      message: "Payment initiated",
      data: {
        order_id: order.order_id,
        order_number: order.order_number,
        payment_id: payment.payment_id,
        amount: totals.final_amount,
        amount_paise: amountPaise,
        currency: "INR",
        razorpay_order_id: razorpayOrder.id,
        razorpay_key_id: process.env.RAZORPAY_KEY_ID,
        subtotal: totals.subtotal,
        tax_amount: totals.tax,
        tax_percentage: totals.tax_percentage,
        delivery_charges: totals.delivery_charges,
        final_amount: totals.final_amount,
        company_name: process.env.RAZORPAY_COMPANY_NAME || "Apom Market",
      },
    });
  } catch (err) {
    if (!t.finished) await t.rollback();
    console.error("initiatePayment error:", err);
    const status =
      err.message.includes("Cart is empty") ||
      err.message.includes("address") ||
      err.message.includes("available") ||
      err.message.includes("Minimum") ||
      err.message.includes("inventory")
        ? 400
        : 500;
    return res.status(status).json({ success: false, message: err.message });
  }
};

/**
 * POST /vendor/payments/verify
 * Verifies Razorpay signature and marks order as paid.
 */
exports.verifyPayment = async (req, res) => {
  const t = await db.sequelize.transaction();
  try {
    const {
      order_id,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    if (!order_id || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: "order_id, razorpay_order_id, razorpay_payment_id, and razorpay_signature are required",
      });
    }

    const vendor = await db.Vendor.findOne({ where: { user_id: req.user.user_id } });
    if (!vendor) {
      await t.rollback();
      return res.status(404).json({ success: false, message: "Vendor not found" });
    }

    const order = await db.Order.findOne({
      where: { order_id, vendor_id: vendor.vendor_id },
      include: [{ model: db.OrderItem, as: "items" }],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!order) {
      await t.rollback();
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.payment_status === "paid") {
      await t.commit();
      return res.json({
        success: true,
        message: "Payment already verified",
        data: { order_id: order.order_id, order_number: order.order_number, payment_status: "paid" },
      });
    }

    const payment = await db.Payment.findOne({
      where: { order_id, razorpay_order_id },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!payment) {
      await t.rollback();
      return res.status(404).json({ success: false, message: "Payment record not found" });
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    const expectedSignature = crypto
      .createHmac("sha256", keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      await t.rollback();
      return res.status(400).json({ success: false, message: "Invalid payment signature" });
    }

    await payment.update(
      {
        razorpay_payment_id,
        razorpay_signature,
        payment_status: "success",
        transaction_id: razorpay_payment_id,
        transaction_date: new Date(),
      },
      { transaction: t }
    );

    await order.update({ payment_status: "paid", order_status: "confirmed" }, { transaction: t });

    const todayStr = new Date();
    const datePart = todayStr.toISOString().slice(0, 10).replace(/-/g, "");
    const startOfDay = new Date(todayStr.setHours(0, 0, 0, 0));
    const endOfDay   = new Date(todayStr.setHours(23, 59, 59, 999));

    const { Op } = require("sequelize");
    const count = await db.PickupDelivery.count({
      where: {
        delivery_type: "delivery",
        created_at: { [Op.between]: [startOfDay, endOfDay] },
      },
      transaction: t,
    });

    const sequence = String(count + 1).padStart(4, "0");
    const delivery_number = `DEL-${datePart}-${sequence}`;

    let expected_quantity_kg = 0;
    if (order.items && order.items.length > 0) {
      expected_quantity_kg = order.items.reduce((sum, item) => sum + parseFloat(item.quantity_kg || 0), 0);
    }

    const deliveryTask = await db.PickupDelivery.create({
      delivery_number,
      delivery_type: "delivery",
      order_id: order.order_id,
      vendor_id: vendor.vendor_id,
      delivery_person_id: null,
      delivery_address: order.delivery_address,
      delivery_contact_name: vendor.owner_name,
      delivery_contact_number: req.user.mobile_number,
      delivery_latitude: order.delivery_latitude || null,
      delivery_longitude: order.delivery_longitude || null,
      scheduled_date: order.expected_delivery_date || null,
      expected_quantity_kg,
      delivery_notes: order.special_instructions || null,
      status: "assigned",
    }, { transaction: t });

    await db.DeliveryStatusHistory.create({
      delivery_id: deliveryTask.delivery_id,
      old_status: null,
      new_status: "assigned",
      changed_by: req.user.user_id,
      remarks: "Delivery task created automatically upon paid vendor order",
    }, { transaction: t });

    await db.Vendor.update(
      {
        cart_items: [],
        total_orders: (vendor.total_orders || 0) + 1,
      },
      { where: { vendor_id: vendor.vendor_id }, transaction: t }
    );

    await t.commit();

    // ── Notify vendor: order confirmed & paid ──
    const { sendNotification } = require("../../utils/notificationService");
    sendNotification({
      userId: req.user.user_id,
      type: "order",
      title: "🎉 Order Confirmed!",
      message: `Order #${order.order_number} has been confirmed. Amount: ₹${order.final_amount}`,
      referenceType: "order",
      referenceId: order.order_id,
      priority: "high",
      fcmData: {
        screen: "order_detail",
        order_id: String(order.order_id),
      },
    }).catch((err) => console.error("Notification error:", err));

    return res.json({
      success: true,
      message: "Payment verified successfully",
      data: {
        order_id: order.order_id,
        order_number: order.order_number,
        payment_status: "paid",
        order_status: "confirmed",
        final_amount: order.final_amount,
        razorpay_payment_id,
        razorpay_order_id,
      },
    });
  } catch (err) {
    if (!t.finished) await t.rollback();
    console.error("verifyPayment error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * POST /vendor/payments/failure
 * Releases reserved inventory when payment fails or is cancelled.
 */
exports.handlePaymentFailure = async (req, res) => {
  const t = await db.sequelize.transaction();
  try {
    const { order_id, failure_reason } = req.body;

    if (!order_id) {
      await t.rollback();
      return res.status(400).json({ success: false, message: "order_id is required" });
    }

    const vendor = await db.Vendor.findOne({ where: { user_id: req.user.user_id } });
    if (!vendor) {
      await t.rollback();
      return res.status(404).json({ success: false, message: "Vendor not found" });
    }

    const order = await db.Order.findOne({
      where: { order_id, vendor_id: vendor.vendor_id },
      include: [{ model: db.OrderItem, as: "items" }],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!order) {
      await t.rollback();
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.payment_status === "paid") {
      await t.commit();
      return res.status(409).json({ success: false, message: "Order is already paid" });
    }

    await releaseOrderReservation({
      order,
      userId: req.user.user_id,
      reason: failure_reason || "Payment cancelled or failed",
      transaction: t,
    });

    await t.commit();

    return res.json({
      success: true,
      message: "Payment failure recorded and inventory released",
      data: { order_id: order.order_id, payment_status: "failed" },
    });
  } catch (err) {
    if (!t.finished) await t.rollback();
    console.error("handlePaymentFailure error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};
