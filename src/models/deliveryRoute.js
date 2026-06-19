const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const DeliveryRoute = sequelize.define(
  "DeliveryRoute",
  {
    route_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    route_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },

    delivery_person_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "delivery_personnel", key: "delivery_person_id" },
    },

    route_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },

    total_stops: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },

    completed_stops: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },

    total_distance_km: {
      type: DataTypes.DECIMAL(10, 2),
    },

    estimated_time_hours: {
      type: DataTypes.DECIMAL(5, 2),
    },

    start_time: {
      type: DataTypes.DATE,
    },

    end_time: {
      type: DataTypes.DATE,
    },

    status: {
      type: DataTypes.ENUM("planned", "in_progress", "completed", "cancelled"),
      defaultValue: "planned",
    },

    optimized_waypoints: {
      type: DataTypes.JSON,
      allowNull: true,
      comment: "Array of lat/lng coordinates",
    },

    created_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "users", key: "user_id" },
    },
  },
  {
    tableName: "delivery_routes",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      { name: "idx_delivery_person", fields: ["delivery_person_id"] },
      { name: "idx_route_date", fields: ["route_date"] },
      { name: "idx_status", fields: ["status"] },
    ],
  }
);

module.exports = DeliveryRoute;