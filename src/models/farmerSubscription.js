const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const FarmerSubscription = sequelize.define(
  "FarmerSubscription",
  {
    subscription_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    farmer_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "farmers", key: "farmer_id" },
    },

    plan_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "subscription_plans", key: "plan_id" },
      comment: "The plan+duration+price this subscription was purchased under",
    },

    plan_type: {
      type: DataTypes.ENUM("basic", "premium"),
      allowNull: false,
      comment: "Denormalized snapshot of the plan at purchase time (survives later admin price/plan edits)",
    },

    duration: {
      type: DataTypes.ENUM("monthly", "quarterly", "annual"),
      allowNull: false,
    },

    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: "Amount actually charged for this cycle (post any annual discount)",
    },

    status: {
      type: DataTypes.ENUM("pending", "active", "expired", "cancelled", "flagged"),
      defaultValue: "pending",
      comment:
        "pending = payment initiated but not verified; active = currently grants access; " +
        "expired = duration lapsed; cancelled = superseded by a newer subscription; " +
        "flagged = admin has flagged this subscription for a payment dispute/edge case",
    },

    start_date: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Set when payment is verified / subscription is activated",
    },

    expiry_date: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "start_date + duration; checked live on gated endpoints, no cron needed",
    },

    is_current: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: "True for at most one row per farmer — the subscription currently granting access",
    },

    admin_note: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Admin remarks when manually verifying/flagging (payment disputes, failed webhooks, etc.)",
    },

    flagged_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "users", key: "user_id" },
      comment: "Admin user who last flagged/verified this subscription",
    },
  },
  {
    tableName: "farmer_subscriptions",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      { name: "idx_sub_farmer", fields: ["farmer_id"] },
      { name: "idx_sub_status", fields: ["status"] },
      { name: "idx_sub_expiry", fields: ["expiry_date"] },
      { name: "idx_sub_farmer_current", fields: ["farmer_id", "is_current"] },
    ],
  }
);

module.exports = FarmerSubscription;