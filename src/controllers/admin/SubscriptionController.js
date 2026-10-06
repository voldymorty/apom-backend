const { Op } = require("sequelize");
const db = require("../../models");

const { FarmerSubscription, Farmer, User, SubscriptionPlan, SubscriptionPayment } = db;

// ─────────────────────────────────────────────
// GET /admin/subscriptions
// List all farmer subscriptions — plan, duration, status, expiry.
// Filters: status, plan_type, search (farmer name / mobile), pagination.
// ─────────────────────────────────────────────
exports.listSubscriptions = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      plan_type,
      search,
      sort_by = "created_at",
      order = "desc",
    } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    const sortableColumns = ["created_at", "expiry_date", "start_date"];
    const sortColumn = sortableColumns.includes(sort_by) ? sort_by : "created_at";
    const sortOrder = order.toLowerCase() === "asc" ? "ASC" : "DESC";

    const where = {};
    if (status) where.status = status;
    if (plan_type) where.plan_type = plan_type;

    const farmerInclude = {
      model: Farmer,
      as: "farmer",
      attributes: ["farmer_id", "full_name"],
      include: [{ model: User, as: "user", attributes: ["user_id", "mobile_number"] }],
    };

    if (search) {
      farmerInclude.where = {
        [Op.or]: [{ full_name: { [Op.like]: `%${search}%` } }],
      };
      farmerInclude.required = true;
    }

    const { count, rows } = await FarmerSubscription.findAndCountAll({
      where,
      include: [
        farmerInclude,
        { model: SubscriptionPlan, as: "plan", attributes: ["plan_id", "plan_type", "duration", "price"] },
      ],
      order: [[sortColumn, sortOrder]],
      limit: limitNum,
      offset,
      distinct: true,
    });

    return res.json({
      success: true,
      message: "Subscriptions fetched successfully",
      data: {
        subscriptions: rows.map((s) => ({
          subscription_id: s.subscription_id,
          farmer_id: s.farmer_id,
          farmer_name: s.farmer?.full_name,
          mobile_number: s.farmer?.user?.mobile_number,
          plan_type: s.plan_type,
          duration: s.duration,
          amount: s.amount,
          status: s.status,
          start_date: s.start_date,
          expiry_date: s.expiry_date,
          is_current: s.is_current,
          admin_note: s.admin_note,
          created_at: s.created_at,
        })),
        pagination: {
          total: count,
          page: pageNum,
          limit: limitNum,
          total_pages: Math.ceil(count / limitNum),
        },
      },
    });
  } catch (err) {
    console.error("listSubscriptions error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// GET /admin/subscriptions/:subscription_id
// Full detail incl. payment trail — for the payment-dispute / failed-webhook edge cases.
// ─────────────────────────────────────────────
exports.getSubscriptionById = async (req, res) => {
  try {
    const { subscription_id } = req.params;

    const subscription = await FarmerSubscription.findOne({
      where: { subscription_id },
      include: [
        {
          model: Farmer,
          as: "farmer",
          attributes: ["farmer_id", "full_name"],
          include: [{ model: User, as: "user", attributes: ["user_id", "mobile_number"] }],
        },
        { model: SubscriptionPlan, as: "plan" },
        { model: SubscriptionPayment, as: "payments", order: [["created_at", "DESC"]] },
      ],
    });

    if (!subscription) {
      return res.status(404).json({ success: false, message: "Subscription not found" });
    }

    return res.json({ success: true, message: "Subscription fetched successfully", data: subscription });
  } catch (err) {
    console.error("getSubscriptionById error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// PATCH /admin/subscriptions/:subscription_id/verify
// Manually verify a subscription (payment disputes, failed webhooks, edge cases).
// Marks it active/current, independent of the Razorpay verify flow.
// ─────────────────────────────────────────────
exports.verifySubscription = async (req, res) => {
  const t = await db.sequelize.transaction();
  try {
    const { subscription_id } = req.params;
    const { admin_note } = req.body;

    const subscription = await FarmerSubscription.findOne({
      where: { subscription_id },
      include: [{ model: SubscriptionPlan, as: "plan" }],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!subscription) {
      await t.rollback();
      return res.status(404).json({ success: false, message: "Subscription not found" });
    }

    // Supersede any other row currently marked current for this farmer
    await FarmerSubscription.update(
      { is_current: false },
      {
        where: { farmer_id: subscription.farmer_id, is_current: true, subscription_id: { [Op.ne]: subscription_id } },
        transaction: t,
      }
    );

    const startDate = subscription.start_date || new Date();
    const durationDays = subscription.plan?.duration_days;
    const expiryDate =
      subscription.expiry_date ||
      (durationDays ? new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000) : null);

    await subscription.update(
      {
        status: "active",
        is_current: true,
        start_date: startDate,
        expiry_date: expiryDate,
        admin_note: admin_note || subscription.admin_note,
        flagged_by: req.user.user_id,
      },
      { transaction: t }
    );

    await t.commit();

    return res.json({
      success: true,
      message: "Subscription manually verified and activated",
      data: { subscription_id: subscription.subscription_id, status: "active" },
    });
  } catch (err) {
    if (!t.finished) await t.rollback();
    console.error("verifySubscription error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// PATCH /admin/subscriptions/:subscription_id/flag
// Flag a subscription (payment dispute, suspicious activity, etc.) — this
// blocks farmer-app access even if the expiry date hasn't passed yet.
// ─────────────────────────────────────────────
exports.flagSubscription = async (req, res) => {
  try {
    const { subscription_id } = req.params;
    const { admin_note } = req.body;

    if (!admin_note || !admin_note.trim()) {
      return res.status(400).json({ success: false, message: "admin_note is required when flagging a subscription" });
    }

    const subscription = await FarmerSubscription.findOne({ where: { subscription_id } });
    if (!subscription) {
      return res.status(404).json({ success: false, message: "Subscription not found" });
    }

    await subscription.update({
      status: "flagged",
      admin_note,
      flagged_by: req.user.user_id,
    });

    return res.json({
      success: true,
      message: "Subscription flagged",
      data: { subscription_id: subscription.subscription_id, status: "flagged" },
    });
  } catch (err) {
    console.error("flagSubscription error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ─────────────────────────────────────────────
// PATCH /admin/subscriptions/:subscription_id/unflag
// Clears a flag, re-evaluating status by the live expiry date.
// ─────────────────────────────────────────────
exports.unflagSubscription = async (req, res) => {
  try {
    const { subscription_id } = req.params;

    const subscription = await FarmerSubscription.findOne({ where: { subscription_id } });
    if (!subscription) {
      return res.status(404).json({ success: false, message: "Subscription not found" });
    }
    if (subscription.status !== "flagged") {
      return res.status(409).json({ success: false, message: "Subscription is not currently flagged" });
    }

    const now = new Date();
    const isExpired = !subscription.expiry_date || new Date(subscription.expiry_date) < now;

    await subscription.update({
      status: isExpired ? "expired" : "active",
      is_current: !isExpired,
      flagged_by: req.user.user_id,
    });

    return res.json({
      success: true,
      message: "Subscription unflagged",
      data: { subscription_id: subscription.subscription_id, status: isExpired ? "expired" : "active" },
    });
  } catch (err) {
    console.error("unflagSubscription error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};