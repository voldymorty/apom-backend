const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const PickupDelivery = sequelize.define(
  "PickupDelivery",
  {
    delivery_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    delivery_number: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },

    delivery_type: {
      type: DataTypes.ENUM("pickup", "delivery"),
      allowNull: false,
    },

    farmer_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "farmers", key: "farmer_id" },
    },

    crop_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "farmer_crops", key: "crop_id" },
    },

    order_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "orders", key: "order_id" },
    },

    vendor_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "vendors", key: "vendor_id" },
    },

    delivery_person_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "delivery_personnel", key: "delivery_person_id" },
    },

    assigned_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "users", key: "user_id" },
    },

    pickup_address: DataTypes.TEXT,
    pickup_latitude: DataTypes.DECIMAL(10, 8),
    pickup_longitude: DataTypes.DECIMAL(11, 8),
    pickup_contact_name: DataTypes.STRING(100),
    pickup_contact_number: DataTypes.STRING(15),

    delivery_address: DataTypes.TEXT,
    delivery_latitude: DataTypes.DECIMAL(10, 8),
    delivery_longitude: DataTypes.DECIMAL(11, 8),
    delivery_contact_name: DataTypes.STRING(100),
    delivery_contact_number: DataTypes.STRING(15),

    scheduled_date: DataTypes.DATEONLY,
    scheduled_time_slot: DataTypes.STRING(20),

    status: {
      type: DataTypes.ENUM(
        "assigned",
        "accepted",
        "in_transit",
        "reached",
        "completed",
        "failed",
        "cancelled"
      ),
      defaultValue: "assigned",
    },

    otp_code: DataTypes.STRING(4),
    otp_verified_at: DataTypes.DATE,

    accepted_at: DataTypes.DATE,
    started_at: DataTypes.DATE,
    reached_at: DataTypes.DATE,
    completed_at: DataTypes.DATE,

    expected_quantity_kg: DataTypes.DECIMAL(10, 2),
    actual_quantity_kg: DataTypes.DECIMAL(10, 2),

    procurement_amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      comment: "Total amount agreed at farmer location (entered by delivery person)",
    },
    procurement_price_per_kg: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    procurement_submitted_at: DataTypes.DATE,
    procurement_status: {
      type: DataTypes.ENUM("pending_review", "finalized"),
      allowNull: true,
    },
    wastage_quantity_kg: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: "Quantity removed as wastage during admin inspection",
    },
    accepted_quantity_kg: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      comment: "Net quantity added to inventory after wastage removal",
    },
    final_procurement_amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      comment: "Final amount fixed by admin after inspection",
    },
    procurement_remarks: DataTypes.TEXT,
    finalized_at: DataTypes.DATE,
    finalized_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "users", key: "user_id" },
    },

    delivery_notes: DataTypes.TEXT,
    failure_reason: DataTypes.TEXT,
    proof_photo_url: DataTypes.TEXT,
    signature_url: DataTypes.TEXT,

    estimated_distance_km: DataTypes.DECIMAL(8, 2),
    actual_distance_km: DataTypes.DECIMAL(8, 2),
    estimated_time_minutes: DataTypes.INTEGER,
    actual_time_minutes: DataTypes.INTEGER,
  },
  {
    tableName: "pickup_deliveries",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      { name: "idx_type", fields: ["delivery_type"] },
      { name: "idx_farmer", fields: ["farmer_id"] },
      { name: "idx_order", fields: ["order_id"] },
      { name: "idx_delivery_person", fields: ["delivery_person_id"] },
      { name: "idx_status", fields: ["status"] },
      { name: "idx_scheduled_date", fields: ["scheduled_date"] },
      { name: "idx_delivery_number", fields: ["delivery_number"] },
    ],
  }
);

module.exports = PickupDelivery;