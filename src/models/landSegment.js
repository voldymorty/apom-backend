const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const LandSegment = sequelize.define(
  "LandSegment",
  {
    segment_id: {
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

    crop_name: {
      type: DataTypes.STRING(150),
      allowNull: false,
      comment: "Crop grown in this segment (snapshot of product_name at time of entry)",
    },

    product_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "FK to products — source of truth for crop selection; nullable for legacy rows created before this field existed",
      references: {
        model: "products",
        key: "product_id",
      },
    },

    area_value: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: "Area of this segment in the farmer's land_unit",
    },

    expected_yield_value: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: "Expected produce quantity from this partition",
    },

    expected_yield_unit: {
      type: DataTypes.ENUM("kg", "ton"),
      allowNull: true,
      defaultValue: "kg",
      comment: "Unit for expected_yield_value",
    },

    area_unit: {
      type: DataTypes.ENUM("acres", "hectares", "cent"),
      allowNull: false,
      defaultValue: "acres",
    },

    plantation_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },

    harvesting_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },

    status: {
      type: DataTypes.ENUM("active", "harvested", "fallow"),
      defaultValue: "active",
    },
  },
  {
    tableName: "land_segments",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      { name: "idx_segment_farmer", fields: ["farmer_id"] },
    ],
  }
);

module.exports = LandSegment;