const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const FarmerEarning = sequelize.define(
  "FarmerEarning",
  {
    earning_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    farmer_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "farmers", key: "farmer_id" },
    },

    crop_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "farmer_crops", key: "crop_id" },
    },

    pickup_delivery_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "pickup_deliveries", key: "delivery_id" },
    },

    quantity_supplied_kg: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },

    price_per_kg: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },

    total_amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
    },

    commission_percentage: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 0.0,
    },

    commission_amount: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0.0,
    },

    net_amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
    },

    payment_status: {
      type: DataTypes.ENUM("pending", "processing", "paid", "failed"),
      defaultValue: "pending",
    },

    payment_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    payment_method: {
      type: DataTypes.ENUM("bank_transfer", "upi", "cash", "cheque"),
      allowNull: true,
    },

    transaction_reference: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    transaction_id: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    remarks: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "farmer_earnings",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      { name: "idx_farmer", fields: ["farmer_id"] },
      { name: "idx_payment_status", fields: ["payment_status"] },
      { name: "idx_created_date", fields: ["created_at"] },
    ],
  }
);

module.exports = FarmerEarning;