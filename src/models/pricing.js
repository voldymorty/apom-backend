const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Pricing = sequelize.define(
  "Pricing",
  {
    pricing_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    product_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "products", key: "product_id" },
    },

    grade: {
      type: DataTypes.ENUM("A", "B", "C"),
      allowNull: false,
    },

    base_price_per_kg: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: "Purchase price from farmer",
    },

    wholesale_price_per_kg: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: "Selling price to vendor",
    },

    retail_price_per_kg: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: "Suggested retail price",
    },

    minimum_order_kg: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 10,
    },

    effective_from: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },

    effective_to: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },

    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },

    updated_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "users", key: "user_id" },
    },
  },
  {
    tableName: "pricing",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      { name: "idx_product_grade", fields: ["product_id", "grade"] },
      { name: "idx_active", fields: ["is_active"] },
      { name: "idx_effective_dates", fields: ["effective_from", "effective_to"] },
    ],
  }
);

module.exports = Pricing;