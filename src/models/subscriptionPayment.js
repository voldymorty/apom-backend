const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

// Mirrors the shape of models/payment.js (vendor order payments), but keyed to a
// farmer subscription instead of an order — kept as a separate table because the
// existing Payment model hard-requires order_id/vendor_id.
const SubscriptionPayment = sequelize.define(
  "SubscriptionPayment",
  {
    subscription_payment_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    subscription_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "farmer_subscriptions", key: "subscription_id" },
    },

    farmer_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "farmers", key: "farmer_id" },
    },

    payment_method: {
      type: DataTypes.ENUM("razorpay"),
      allowNull: false,
      defaultValue: "razorpay",
    },

    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },

    payment_status: {
      type: DataTypes.ENUM("initiated", "pending", "success", "failed", "refunded"),
      defaultValue: "initiated",
    },

    razorpay_order_id: {
      type: DataTypes.STRING(100),
    },

    razorpay_payment_id: {
      type: DataTypes.STRING(100),
    },

    razorpay_signature: {
      type: DataTypes.STRING(255),
    },

    transaction_id: {
      type: DataTypes.STRING(100),
    },

    transaction_date: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },

    failure_reason: {
      type: DataTypes.TEXT,
    },
  },
  {
    tableName: "subscription_payments",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      { name: "idx_subpay_subscription", fields: ["subscription_id"] },
      { name: "idx_subpay_farmer", fields: ["farmer_id"] },
      { name: "idx_subpay_razorpay_order", fields: ["razorpay_order_id"] },
      { name: "idx_subpay_status", fields: ["payment_status"] },
    ],
  }
);

module.exports = SubscriptionPayment;