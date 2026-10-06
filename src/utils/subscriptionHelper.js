const db = require("../models");

/**
 * Returns the farmer's currently-relevant subscription row (is_current = true), or null.
 * Does NOT mutate anything — pure read. Use `getLiveSubscriptionStatus` when you need the
 * live expiry check (i.e. whether it still actually grants access right now).
 */
async function getCurrentSubscription(farmerId, { transaction } = {}) {
  return db.FarmerSubscription.findOne({
    where: { farmer_id: farmerId, is_current: true },
    include: [{ model: db.SubscriptionPlan, as: "plan" }],
    transaction,
  });
}

/**
 * Live expiry check (no cron/background job — matches the module spec).
 * If the current subscription's expiry_date has passed, flips it to "expired" in place
 * (unless it's already "flagged" by an admin, which always blocks access regardless of dates).
 *
 * Returns { hasAccess, subscription, reason } where reason is one of:
 *   "active" | "none" | "expired" | "flagged"
 */
async function getLiveSubscriptionStatus(farmerId) {
  const subscription = await getCurrentSubscription(farmerId);

  if (!subscription) {
    return { hasAccess: false, subscription: null, reason: "none" };
  }

  if (subscription.status === "flagged") {
    return { hasAccess: false, subscription, reason: "flagged" };
  }

  const now = new Date();
  const isExpired = !subscription.expiry_date || new Date(subscription.expiry_date) < now;

  if (isExpired && subscription.status !== "expired") {
    await subscription.update({ status: "expired", is_current: false });
  }

  if (isExpired) {
    return { hasAccess: false, subscription, reason: "expired" };
  }

  return { hasAccess: subscription.status === "active", subscription, reason: "active" };
}

/**
 * duration -> duration_days is stored on SubscriptionPlan itself, but this stays here
 * as the single source of truth for computing an expiry_date from a start_date + plan.
 */
function computeExpiryDate(startDate, durationDays) {
  const expiry = new Date(startDate);
  expiry.setDate(expiry.getDate() + durationDays);
  return expiry;
}

module.exports = { getCurrentSubscription, getLiveSubscriptionStatus, computeExpiryDate };