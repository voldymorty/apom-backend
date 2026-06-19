const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Payment = sequelize.define(
  "Payment",
  {
    payment_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    order_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "orders", key: "order_id" },
    },

    vendor_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "vendors", key: "vendor_id" },
    },

    payment_method: {
      type: DataTypes.ENUM("razorpay", "cash", "bank_transfer", "upi", "card"),
      allowNull: false,
    },

    amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
    },

    payment_status: {
      type: DataTypes.ENUM(
        "initiated",
        "pending",
        "success",
        "failed",
        "refunded"
      ),
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

    refund_amount: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0,
    },

    refund_date: {
      type: DataTypes.DATE,
    },

    refund_reference: {
      type: DataTypes.STRING(100),
    },
  },
  {
    tableName: "payments",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      { name: "idx_order", fields: ["order_id"] },
      { name: "idx_vendor", fields: ["vendor_id"] },
      { name: "idx_razorpay_order", fields: ["razorpay_order_id"] },
      { name: "idx_status", fields: ["payment_status"] },
      { name: "idx_transaction_date", fields: ["transaction_date"] },
    ],
  }
);

module.exports = Payment;