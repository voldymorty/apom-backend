const db = require("../../models");
const { SubscriptionPlan } = db;

const PLAN_TYPES = ["basic", "premium"];
const DURATIONS = ["monthly", "quarterly", "annual"];

// ─────────────────────────────────────────────
// GET /admin/subscription-plans
// All plans (active + inactive) — admin needs to see everything to manage pricing.
// ─────────────────────────────────────────────
exports.listPlans = async (req, res) => {
  try {
    const plans = await SubscriptionPlan.findAll({
      order: [
        ["plan_type", "ASC"],
        ["duration_days", "ASC"],
      ],
    });
    return res.json({ success: true, message: "Plans fetched successfully", data: plans });
  } catch (err) {
    console.error("listPlans error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// POST /admin/subscription-plans
// Create a new plan+duration price point. Since it's the admin who defines the
// catalogue from scratch (no code-side seed), this is how the four initial rows
// — Basic/Premium x Monthly/Quarterly/Annual — get created.
// ─────────────────────────────────────────────
exports.createPlan = async (req, res) => {
  try {
    const { plan_type, duration, price, duration_days, is_active } = req.body;

    if (!plan_type || !duration || price === undefined || duration_days === undefined) {
      return res.status(400).json({
        success: false,
        message: "plan_type, duration, price, and duration_days are required",
      });
    }
    if (!PLAN_TYPES.includes(plan_type)) {
      return res.status(400).json({ success: false, message: `plan_type must be one of ${PLAN_TYPES.join(", ")}` });
    }
    if (!DURATIONS.includes(duration)) {
      return res.status(400).json({ success: false, message: `duration must be one of ${DURATIONS.join(", ")}` });
    }
    if (parseFloat(price) <= 0) {
      return res.status(400).json({ success: false, message: "price must be greater than 0" });
    }
    if (parseInt(duration_days) <= 0) {
      return res.status(400).json({ success: false, message: "duration_days must be greater than 0" });
    }

    const existing = await SubscriptionPlan.findOne({ where: { plan_type, duration } });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `A plan for ${plan_type} / ${duration} already exists (plan_id ${existing.plan_id}). Edit it instead of creating a duplicate.`,
      });
    }

    const plan = await SubscriptionPlan.create({
      plan_type,
      duration,
      price,
      duration_days,
      is_active: is_active === undefined ? true : !!is_active,
    });

    return res.status(201).json({ success: true, message: "Plan created successfully", data: plan });
  } catch (err) {
    console.error("createPlan error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// PATCH /admin/subscription-plans/:plan_id
// Update price / duration_days / is_active. plan_type & duration are the identity
// of the row (unique together), so they're intentionally not editable here — create
// a new plan instead if you need a different plan_type/duration combination.
// ─────────────────────────────────────────────
exports.updatePlan = async (req, res) => {
  try {
    const { plan_id } = req.params;
    const { price, duration_days, is_active } = req.body;

    const plan = await SubscriptionPlan.findOne({ where: { plan_id } });
    if (!plan) {
      return res.status(404).json({ success: false, message: "Plan not found" });
    }

    const updates = {};
    if (price !== undefined) {
      if (parseFloat(price) <= 0) {
        return res.status(400).json({ success: false, message: "price must be greater than 0" });
      }
      updates.price = price;
    }
    if (duration_days !== undefined) {
      if (parseInt(duration_days) <= 0) {
        return res.status(400).json({ success: false, message: "duration_days must be greater than 0" });
      }
      updates.duration_days = duration_days;
    }
    if (is_active !== undefined) {
      updates.is_active = !!is_active;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: "No valid fields provided" });
    }

    await plan.update(updates);

    return res.json({ success: true, message: "Plan updated successfully", data: plan });
  } catch (err) {
    console.error("updatePlan error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// PATCH /admin/subscription-plans/:plan_id/deactivate
// Soft-disable only — plans are referenced by existing FarmerSubscription rows
// (plan_id FK), so hard delete is intentionally not exposed. Deactivating just
// hides it from the farmer app's plan picker; past/active subscriptions on it
// keep working untouched.
// ─────────────────────────────────────────────
exports.deactivatePlan = async (req, res) => {
  try {
    const { plan_id } = req.params;

    const plan = await SubscriptionPlan.findOne({ where: { plan_id } });
    if (!plan) {
      return res.status(404).json({ success: false, message: "Plan not found" });
    }

    await plan.update({ is_active: false });

    return res.json({ success: true, message: "Plan deactivated", data: plan });
  } catch (err) {
    console.error("deactivatePlan error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};