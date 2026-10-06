const db = require("../models");
const { getLiveSubscriptionStatus } = require("../utils/subscriptionHelper");

/**
 * requireActiveSubscription
 *
 * Hard paywall middleware for the Farmer App — per the module spec, farmers get
 * "no listing/dashboard access at all if subscription has lapsed", checked live
 * on every request (no background/cron job). Apply this AFTER `authenticate`
 * (it needs req.user.user_id) on the crop-listing and dashboard routes.
 *
 * On block, responds 402 Payment Required with a `reason` the Flutter app uses
 * to decide which paywall screen to show:
 *   "none"    -> farmer has never subscribed        -> show plan picker
 *   "expired" -> subscription lapsed                -> show renew screen
 *   "flagged" -> admin flagged this subscription     -> show "contact support" screen
 *
 * On pass, attaches req.subscription so downstream controllers can use it if needed.
 */
const requireActiveSubscription = async (req, res, next) => {
  try {
    const farmer = await db.Farmer.findOne({ where: { user_id: req.user.user_id } });
    if (!farmer) {
      return res.status(404).json({ success: false, message: "Farmer not found" });
    }

    const { hasAccess, subscription, reason } = await getLiveSubscriptionStatus(farmer.farmer_id);

    if (!hasAccess) {
      return res.status(402).json({
        success: false,
        message:
          reason === "flagged"
            ? "Your subscription has been flagged by admin. Please contact support."
            : reason === "expired"
            ? "Your subscription has expired. Please renew to continue."
            : "An active subscription is required to access this feature.",
        data: {
          reason,
          subscription: subscription
            ? {
                subscription_id: subscription.subscription_id,
                plan_type: subscription.plan_type,
                duration: subscription.duration,
                status: subscription.status,
                expiry_date: subscription.expiry_date,
              }
            : null,
        },
      });
    }

    req.subscription = subscription;
    next();
  } catch (err) {
    console.error("requireActiveSubscription error:", err);
    return res.status(500).json({ success: false, message: "Unable to verify subscription status" });
  }
};

module.exports = { requireActiveSubscription };