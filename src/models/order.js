// order.js

const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Order = sequelize.define(
  "Order",
  {
    order_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    order_number: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },

    vendor_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "vendors", key: "vendor_id" },
    },

    order_date: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },

    subtotal_amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
    },

    discount_percentage: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 0,
    },

    discount_amount: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0,
    },

    tax_percentage: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 0,
    },

    tax_amount: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0,
    },

    delivery_charges: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
    },

    final_amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
    },

    payment_status: {
      type: DataTypes.ENUM("pending", "paid", "partial", "failed", "refunded"),
      defaultValue: "pending",
    },

    order_status: {
      type: DataTypes.ENUM(
        "placed",
        "confirmed",
        "processing",
        "ready",
        "dispatched",
        "delivered",
        "cancelled",
        "returned"
      ),
      defaultValue: "placed",
    },

    delivery_address_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "vendor_addresses", key: "address_id" },
    },

    delivery_address: {
      type: DataTypes.TEXT,
      allowNull: false,
    },

    delivery_latitude: {
      type: DataTypes.DECIMAL(10, 8),
    },

    delivery_longitude: {
      type: DataTypes.DECIMAL(11, 8),
    },

    expected_delivery_date: {
      type: DataTypes.DATEONLY,
    },

    actual_delivery_date: {
      type: DataTypes.DATE,
    },

    special_instructions: {
      type: DataTypes.TEXT,
    },

    cancellation_reason: {
      type: DataTypes.TEXT,
    },

    cancelled_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "users", key: "user_id" },
    },

    cancelled_at: {
      type: DataTypes.DATE,
    },
  },
  {
    tableName: "orders",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      { name: "idx_vendor", fields: ["vendor_id"] },
      { name: "idx_order_number", fields: ["order_number"] },
      { name: "idx_order_status", fields: ["order_status"] },
      { name: "idx_payment_status", fields: ["payment_status"] },
      { name: "idx_order_date", fields: ["order_date"] },
      { name: "idx_delivery_date", fields: ["expected_delivery_date"] },
    ],
  }
);

module.exports = Order;