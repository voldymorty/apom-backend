const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Farmer = sequelize.define(
  "Farmer",
  {
    farmer_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      references: { model: "users", key: "user_id" },
    },

    full_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },

    aadhar_number: {
      type: DataTypes.STRING(12),
      allowNull: true,
      unique: true,
    },

    farm_name: {
      type: DataTypes.STRING(150),
      allowNull: true,
      comment: "Optional farm/field name",
    },

    location_address: {
      type: DataTypes.TEXT,
      allowNull: false,
    },

    // ─── Location as IDs ──────────────────────────────────────
    state_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "states", key: "state_id" },
    },

    district_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "districts", key: "district_id" },
    },

    city_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "cities", key: "city_id" },
    },

    pincode: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },

    latitude: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: true,
    },

    longitude: {
      type: DataTypes.DECIMAL(11, 8),
      allowNull: true,
    },

    // ─── Land ─────────────────────────────────────────────────
    total_land: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      comment: "Total farm size in the chosen unit",
    },

    land_unit: {
      type: DataTypes.ENUM("acres", "hectares", "cent"),
      allowNull: false,
      defaultValue: "acres",
    },

    allocated_land: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.0,
    },

    available_land: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },

    // ─── Photos ───────────────────────────────────────────────
    profile_photo_url: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    land_photo_url: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    // ─── Stats ────────────────────────────────────────────────
    total_supplies: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },

    total_earnings: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0.0,
    },
  },
  {
    tableName: "farmers",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      { name: "idx_farmer_user", fields: ["user_id"] },
      { name: "idx_farmer_location", fields: ["latitude", "longitude"] },
      { name: "idx_farmer_state", fields: ["state_id"] },
      { name: "idx_farmer_district", fields: ["district_id"] },
    ],
  }
);

module.exports = Farmer;