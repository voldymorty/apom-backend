const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const DeliveryPersonnel = sequelize.define(
  "DeliveryPersonnel",
  {
    delivery_person_id: {
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

    profile_photo_url: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    vehicle_type: {
      type: DataTypes.ENUM("bike", "auto", "tempo", "truck", "van"),
      allowNull: false,
    },

    vehicle_number: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,
    },

    license_number: {
      type: DataTypes.STRING(20),
      allowNull: true,
      unique: true,
    },

    license_expiry_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },

    is_available: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },

    current_latitude: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: true,
    },

    current_longitude: {
      type: DataTypes.DECIMAL(11, 8),
      allowNull: true,
    },

    last_location_update: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    total_deliveries: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },

    completed_deliveries: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },

    rating: {
      type: DataTypes.DECIMAL(3, 2),
      defaultValue: 0.0,
    },
  },
  {
    tableName: "delivery_personnel",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      { name: "idx_available", fields: ["is_available"] },
      { name: "idx_location", fields: ["current_latitude", "current_longitude"] },
    ],
  }
);

module.exports = DeliveryPersonnel;