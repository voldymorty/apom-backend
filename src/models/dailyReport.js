const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const DailyReport = sequelize.define(
  "DailyReport",
  {
    report_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    report_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      unique: true,
    },

    // Order metrics
    total_orders: { type: DataTypes.INTEGER, defaultValue: 0 },
    completed_orders: { type: DataTypes.INTEGER, defaultValue: 0 },
    cancelled_orders: { type: DataTypes.INTEGER, defaultValue: 0 },
    pending_orders: { type: DataTypes.INTEGER, defaultValue: 0 },
    total_order_value: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },

    // Delivery metrics
    total_pickups: { type: DataTypes.INTEGER, defaultValue: 0 },
    completed_pickups: { type: DataTypes.INTEGER, defaultValue: 0 },
    failed_pickups: { type: DataTypes.INTEGER, defaultValue: 0 },
    total_deliveries: { type: DataTypes.INTEGER, defaultValue: 0 },
    completed_deliveries: { type: DataTypes.INTEGER, defaultValue: 0 },
    failed_deliveries: { type: DataTypes.INTEGER, defaultValue: 0 },

    // Procurement metrics
    total_farmers_supplied: { type: DataTypes.INTEGER, defaultValue: 0 },
    total_quantity_procured_kg: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },

    // Financial metrics
    total_revenue: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
    total_commission_earned: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
    total_farmer_earnings: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
    total_delivery_charges: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },

    // Registration metrics
    new_farmers_registered: { type: DataTypes.INTEGER, defaultValue: 0 },
    new_vendors_registered: { type: DataTypes.INTEGER, defaultValue: 0 },
    new_delivery_personnel: { type: DataTypes.INTEGER, defaultValue: 0 },

    // User activity
    active_farmers: { type: DataTypes.INTEGER, defaultValue: 0 },
    active_vendors: { type: DataTypes.INTEGER, defaultValue: 0 },
    active_delivery_personnel: { type: DataTypes.INTEGER, defaultValue: 0 },
  },
  {
    tableName: "daily_reports",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      { name: "idx_report_date", fields: ["report_date"] }
    ],
  }
);

module.exports = DailyReport;