const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

// Admin-editable pricing catalogue: one row per (plan_type, duration) combination.
// Seeded with Basic/Premium × Monthly/Quarterly/Annual at setup time; admin can
// update prices later via the admin panel without a code change.
const SubscriptionPlan = sequelize.define(
  "SubscriptionPlan",
  {
    plan_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    plan_type: {
      type: DataTypes.ENUM("basic", "premium"),
      allowNull: false,
    },

    duration: {
      type: DataTypes.ENUM("monthly", "quarterly", "annual"),
      allowNull: false,
    },

    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: "Final amount charged for this plan+duration (discount, if any, already applied)",
    },

    duration_days: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Used to compute expiry_date = start_date + duration_days (e.g. 30/90/365)",
    },

    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      comment: "Inactive plans are hidden from farmers but existing subscriptions on them still work",
    },
  },
  {
    tableName: "subscription_plans",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        name: "idx_plan_type_duration",
        unique: true,
        fields: ["plan_type", "duration"],
      },
    ],
  }
);

module.exports = SubscriptionPlan;