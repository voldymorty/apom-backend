const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const DeliveryStatusHistory = sequelize.define(
  "DeliveryStatusHistory",
  {
    history_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    delivery_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "pickup_deliveries", key: "delivery_id" },
    },

    old_status: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },

    new_status: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },

    changed_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "users", key: "user_id" },
    },

    latitude: {
      type: DataTypes.DECIMAL(10, 8),
    },

    longitude: {
      type: DataTypes.DECIMAL(11, 8),
    },

    remarks: {
      type: DataTypes.TEXT,
    },

    photo_url: {
      type: DataTypes.TEXT,
    },
  },
  {
    tableName: "delivery_status_history",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false,
    indexes: [
      { name: "idx_delivery", fields: ["delivery_id"] },
      { name: "idx_created_date", fields: ["created_at"] },
      { name: "idx_status", fields: ["new_status"] },
    ],
  }
);

module.exports = DeliveryStatusHistory;