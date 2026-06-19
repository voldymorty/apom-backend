const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Product = sequelize.define(
  "Product",
  {
    product_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    category_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "categories", key: "category_id" },
    },

    product_name: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },

    product_code: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },

    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    unit: {
      type: DataTypes.ENUM("kg", "piece", "bunch", "dozen", "gram"),
      defaultValue: "kg",
    },

    image_url: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    is_seasonal: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },

    season_start_month: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "1-12 for January-December",
    },

    season_end_month: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    tableName: "products",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      { name: "idx_category", fields: ["category_id"] },
      { name: "idx_active", fields: ["is_active"] },
      { name: "idx_seasonal", fields: ["is_seasonal"] },
    ],
  }
);

module.exports = Product;