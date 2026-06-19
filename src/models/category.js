const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Category = sequelize.define(
  "Category",
  {
    category_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    category_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },

    category_code: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,
    },

    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    image_url: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    icon_url: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },

    display_order: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
  },
  {
    tableName: "categories",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    sync: false, // ← prevents alter from touching this table
    indexes: [
      { name: "idx_active", fields: ["is_active"] },
      { name: "idx_order", fields: ["display_order"] },
    ],
  }
);

module.exports = Category;