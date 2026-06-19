const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const User = sequelize.define(
  "User",
  {
    user_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    mobile_number: {
      type: DataTypes.STRING(15),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true,
      },
    },

    password_hash: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    role: {
      type: DataTypes.ENUM("admin", "farmer", "vendor", "delivery"),
      allowNull: false,
    },

    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },

    is_verified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },

    profile_complete: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },

    email: {
      type: DataTypes.STRING(100),
      allowNull: true,
      validate: {
        isEmail: true,
      },
    },

    last_login: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    fcm_token: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: "Firebase Cloud Messaging token for push notifications",
    },
  },
  {
    tableName: "users",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      { name: "idx_mobile", fields: ["mobile_number"] },
      { name: "idx_role", fields: ["role"] },
      { name: "idx_active", fields: ["is_active"] },
    ],
  }
);

module.exports = User;