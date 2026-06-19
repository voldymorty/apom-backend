const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const FarmerCrop = sequelize.define(
  "FarmerCrop",
  {
    crop_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    farmer_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "farmers",
        key: "farmer_id",
      },
    },

    segment_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "land_segments",
        key: "segment_id",
      },
    },

    product_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "products",
        key: "product_id",
      },
    },

    quantity_kg: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },

    grade: {
      type: DataTypes.ENUM("A", "B", "C"),
      allowNull: false,
    },

    expected_price_per_kg: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },

    harvest_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },

    is_ready: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },

    crop_photo_url: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    status: {
      type: DataTypes.ENUM(
        "available",
        "pickup_assigned",
        "picked_up",
        "cancelled"
      ),
      defaultValue: "available",
    },

    remarks: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "farmer_crops",

    timestamps: true,

    createdAt: "created_at",
    updatedAt: "updated_at",

    indexes: [
      { name: "idx_farmer", fields: ["farmer_id"] },
      { name: "idx_product", fields: ["product_id"] },
      { name: "idx_status", fields: ["status"] },
      { name: "idx_ready", fields: ["is_ready"] },
    ],
  }
);

module.exports = FarmerCrop;