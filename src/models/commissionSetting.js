const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const CommissionSetting = sequelize.define(
  "CommissionSetting",
  {
    setting_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    user_type: {
      type: DataTypes.ENUM(
        "farmer",
        "vendor",
        "delivery_personnel",
        "platform"
      ),
      allowNull: false,
    },

    commission_type: {
      type: DataTypes.ENUM("percentage", "fixed", "tiered"),
      allowNull: false,
    },

    commission_value: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },

    minimum_transaction_amount: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0,
    },

    maximum_commission_amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
    },

    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },

    effective_from: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },

    effective_to: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },

    description: {
      type: DataTypes.TEXT,
    },

    created_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "users", key: "user_id" },
    },
  },
  {
    tableName: "commission_settings",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      { name: "idx_user_type", fields: ["user_type"] },
      { name: "idx_active", fields: ["is_active"] },
      { name: "idx_effective_dates", fields: ["effective_from", "effective_to"] },
    ],
  }
);

module.exports = CommissionSetting;