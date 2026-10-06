const crypto = require("crypto");
const Razorpay = require("razorpay");
const db = require("../../models");
const {
  getLiveSubscriptionStatus,
  computeExpiryDate,
} = require("../../utils/subscriptionHelper");

function getRazorpayClient() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error("Razorpay credentials are not configured on the server");
  }
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

async function getFarmerOrFail(req, res) {
  const farmer = await db.Farmer.findOne({ where: { user_id: req.user.user_id } });
  if (!farmer) {
    res.status(404).json({ success: false, message: "Farmer not found" });
    return null;
  }
  return farmer;
}

/**
 * GET /farmer/subscriptions/plans
 * Public-to-farmers catalogue of active plans, for the plan/duration picker screen.
 */
exports.getPlans = async (req, res) => {
  try {
    const plans = await db.SubscriptionPlan.findAll({
      where: { is_active: true },
      order: [
        ["plan_type", "ASC"],
        ["duration_days", "ASC"],
      ],
    });
    return res.json({ success: true, data: plans });
  } catch (err) {
    console.error("getPlans error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /farmer/subscriptions/status
 * Live status for the logged-in farmer — drives the paywall UI (which reason
 * to show: none / expired / flagged / active + expiry countdown).
 */
exports.getStatus = async (req, res) => {
  try {
    const farmer = await getFarmerOrFail(req, res);
    if (!farmer) return;

    const { hasAccess, subscription, reason } = await getLiveSubscriptionStatus(farmer.farmer_id);

    return res.json({
      success: true,
      data: {
        has_access: hasAccess,
        reason,
        subscription: subscription
          ? {
              subscription_id: subscription.subscription_id,
              plan_type: subscription.plan_type,
              duration: subscription.duration,
              status: subscription.status,
              start_date: subscription.start_date,
              expiry_date: subscription.expiry_date,
              admin_note: subscription.status === "flagged" ? subscription.admin_note : undefined,
            }
          : null,
      },
    });
  } catch (err) {
    console.error("getStatus error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * POST /farmer/subscriptions/initiate
 * body: { plan_id }
 * Creates a pending FarmerSubscription + SubscriptionPayment, then a Razorpay order.
 * Mirrors controllers/vendor/paymentController.js:initiatePayment.
 */
exports.initiatePayment = async (req, res) => {
  const t = await db.sequelize.transaction();
  try {
    const farmer = await getFarmerOrFail(req, res);
    if (!farmer) {
      await t.rollback();
      return;
    }

    const { plan_id } = req.body;
    if (!plan_id) {
      await t.rollback();
      return res.status(400).json({ success: false, message: "plan_id is required" });
    }

    const plan = await db.SubscriptionPlan.findOne({
      where: { plan_id, is_active: true },
      transaction: t,
    });
    if (!plan) {
      await t.rollback();
      return res.status(404).json({ success: false, message: "Plan not found or inactive" });
    }

    const subscription = await db.FarmerSubscription.create(
      {
        farmer_id: farmer.farmer_id,
        plan_id: plan.plan_id,
        plan_type: plan.plan_type,
        duration: plan.duration,
        amount: plan.price,
        status: "pending",
        is_current: false,
      },
      { transaction: t }
    );

    const payment = await db.SubscriptionPayment.create(
      {
        subscription_id: subscription.subscription_id,
        farmer_id: farmer.farmer_id,
        payment_method: "razorpay",
        amount: plan.price,
        payment_status: "initiated",
      },
      { transaction: t }
    );

    await t.commit();

    const razorpay = getRazorpayClient();
    const amountPaise = Math.round(parseFloat(plan.price) * 100);

    let razorpayOrder;
    try {
      razorpayOrder = await razorpay.orders.create({
        amount: amountPaise,
        currency: "INR",
        receipt: `SUB-${subscription.subscription_id}`,
        notes: {
          subscription_id: String(subscription.subscription_id),
          farmer_id: String(farmer.farmer_id),
          payment_id: String(payment.subscription_payment_id),
        },
      });
    } catch (rzErr) {
      console.error("Razorpay Error:", rzErr);
      await db.SubscriptionPayment.update(
        { payment_status: "failed", failure_reason: JSON.stringify(rzErr) },
        { where: { subscription_payment_id: payment.subscription_payment_id } }
      );
      await db.FarmerSubscription.update(
        { status: "cancelled" },
        { where: { subscription_id: subscription.subscription_id } }
      );
      throw new Error(
        `Unable to create Razorpay order: ${rzErr.error?.description || rzErr.message}`
      );
    }

    await payment.update({ razorpay_order_id: razorpayOrder.id });

    return res.json({
      success: true,
      message: "Razorpay order created",
      data: {
        subscription_id: subscription.subscription_id,
        razorpay_order_id: razorpayOrder.id,
        razorpay_key_id: process.env.RAZORPAY_KEY_ID,
        amount: plan.price,
        currency: "INR",
        plan_type: plan.plan_type,
        duration: plan.duration,
        // company_name: process.env.RAZORPAY_COMPANY_NAME || "Apom Farmer",
        company_name: "Apom Farmer",
      },
    });
  } catch (err) {
    if (!t.finished) await t.rollback();
    console.error("initiatePayment error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * POST /farmer/subscriptions/verify
 * body: { subscription_id, razorpay_order_id, razorpay_payment_id, razorpay_signature }
 * Verifies Razorpay signature, activates the subscription, and supersedes any
 * previous is_current row for this farmer.
 */
exports.verifyPayment = async (req, res) => {
  const t = await db.sequelize.transaction();
  try {
    const {
      subscription_id,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    if (!subscription_id || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message:
          "subscription_id, razorpay_order_id, razorpay_payment_id, and razorpay_signature are required",
      });
    }

    const farmer = await db.Farmer.findOne({
      where: { user_id: req.user.user_id },
      transaction: t,
    });
    if (!farmer) {
      await t.rollback();
      return res.status(404).json({ success: false, message: "Farmer not found" });
    }

    const subscription = await db.FarmerSubscription.findOne({
      where: { subscription_id, farmer_id: farmer.farmer_id },
      include: [{ model: db.SubscriptionPlan, as: "plan" }],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!subscription) {
      await t.rollback();
      return res.status(404).json({ success: false, message: "Subscription not found" });
    }

    if (subscription.status === "active" && subscription.is_current) {
      await t.commit();
      return res.json({
        success: true,
        message: "Payment already verified",
        data: { subscription_id: subscription.subscription_id, status: "active" },
      });
    }

    const payment = await db.SubscriptionPayment.findOne({
      where: { subscription_id, razorpay_order_id },
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

    // Supersede whatever was previously current for this farmer (renewal / upgrade / downgrade)
    await db.FarmerSubscription.update(
      { is_current: false },
      {
        where: { farmer_id: farmer.farmer_id, is_current: true },
        transaction: t,
      }
    );

    const startDate = new Date();
    const expiryDate = computeExpiryDate(startDate, subscription.plan.duration_days);

    await subscription.update(
      {
        status: "active",
        is_current: true,
        start_date: startDate,
        expiry_date: expiryDate,
      },
      { transaction: t }
    );

    await t.commit();

    return res.json({
      success: true,
      message: "Payment verified — subscription activated",
      data: {
        subscription_id: subscription.subscription_id,
        status: "active",
        plan_type: subscription.plan_type,
        duration: subscription.duration,
        start_date: startDate,
        expiry_date: expiryDate,
      },
    });
  } catch (err) {
    if (!t.finished) await t.rollback();
    console.error("verifyPayment error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * POST /farmer/subscriptions/failure
 * body: { subscription_id, failure_reason }
 */
exports.handlePaymentFailure = async (req, res) => {
  const t = await db.sequelize.transaction();
  try {
    const { subscription_id, failure_reason } = req.body;
    if (!subscription_id) {
      await t.rollback();
      return res.status(400).json({ success: false, message: "subscription_id is required" });
    }

    const farmer = await getFarmerOrFail(req, res);
    if (!farmer) {
      await t.rollback();
      return;
    }

    const subscription = await db.FarmerSubscription.findOne({
      where: { subscription_id, farmer_id: farmer.farmer_id },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!subscription) {
      await t.rollback();
      return res.status(404).json({ success: false, message: "Subscription not found" });
    }

    if (subscription.status === "active" && subscription.is_current) {
      await t.commit();
      return res.status(409).json({ success: false, message: "Subscription is already active" });
    }

    await db.SubscriptionPayment.update(
      { payment_status: "failed", failure_reason: failure_reason || "Payment cancelled or failed" },
      { where: { subscription_id }, transaction: t }
    );

    await subscription.update({ status: "cancelled" }, { transaction: t });

    await t.commit();

    return res.json({
      success: true,
      message: "Payment failure recorded",
      data: { subscription_id: subscription.subscription_id, status: "cancelled" },
    });
  } catch (err) {
    if (!t.finished) await t.rollback();
    console.error("handlePaymentFailure error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};