const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Vendor = sequelize.define(
  "Vendor",
  {
    vendor_id: {
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
    shop_name: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    owner_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    vendor_photo_url: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    shop_photo_url: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    gst_number: {
      type: DataTypes.STRING(15),
      allowNull: true,
      unique: true,
    },
    primary_address: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    pincode: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },

    // ── Location FK fields ─────────────────────────────────────
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

    // ── Coordinates ────────────────────────────────────────────
    latitude: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: true,
    },
    longitude: {
      type: DataTypes.DECIMAL(11, 8),
      allowNull: true,
    },

    business_type: {
      type: DataTypes.ENUM("retail", "restaurant", "hotel", "wholesale", "other"),
      defaultValue: "retail",
    },
    total_orders: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    cart_items: {
  type: DataTypes.JSON,
  allowNull: true,
  defaultValue: [],
},
  },
  {
    tableName: "vendors",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      { name: "idx_user",     fields: ["user_id"] },
      { name: "idx_gst",      fields: ["gst_number"] },
      { name: "idx_state",    fields: ["state_id"] },
      { name: "idx_district", fields: ["district_id"] },
      { name: "idx_city",     fields: ["city_id"] },
    ],
  }
);

module.exports = Vendor;