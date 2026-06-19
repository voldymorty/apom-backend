const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const VendorAddress = sequelize.define(
  "VendorAddress",
  {
    address_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    vendor_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "vendors", key: "vendor_id" },
    },

    address_label: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: "e.g., Main Shop, Branch 1, Warehouse",
    },

    contact_person: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    contact_number: {
      type: DataTypes.STRING(15),
      allowNull: true,
    },

    address_line1: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },

    address_line2: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    landmark: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    city: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },

    district: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },

    state: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },

    pincode: {
      type: DataTypes.STRING(10),
      allowNull: false,
    },

    latitude: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: true,
    },

    longitude: {
      type: DataTypes.DECIMAL(11, 8),
      allowNull: true,
    },

    is_default: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },

    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    tableName: "vendor_addresses",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      { name: "idx_vendor", fields: ["vendor_id"] },
      { name: "idx_default", fields: ["is_default"] },
      { name: "idx_location", fields: ["latitude", "longitude"] },
    ],
  }
);

module.exports = VendorAddress;