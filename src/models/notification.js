const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Notification = sequelize.define(
  "Notification",
  {
    notification_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "users", key: "user_id" },
    },

    notification_type: {
      type: DataTypes.ENUM(
        "order",
        "delivery",
        "payment",
        "approval",
        "general",
        "earning",
        "alert"
      ),
      allowNull: false,
    },

    title: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },

    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },

    reference_type: {
      type: DataTypes.ENUM(
        "order",
        "delivery",
        "payment",
        "crop",
        "earning",
        "user"
      ),
      allowNull: true,
    },

    reference_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    action_url: {
      type: DataTypes.TEXT,
    },

    is_read: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },

    read_at: {
      type: DataTypes.DATE,
    },

    priority: {
      type: DataTypes.ENUM("low", "medium", "high", "urgent"),
      defaultValue: "medium",
    },

    send_push: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },

    push_sent_at: {
      type: DataTypes.DATE,
    },
  },
  {
    tableName: "notifications",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false,
    indexes: [
      { name: "idx_user", fields: ["user_id"] },
      { name: "idx_read", fields: ["is_read"] },
      { name: "idx_type", fields: ["notification_type"] },
      { name: "idx_priority", fields: ["priority"] },
      { name: "idx_created_date", fields: ["created_at"] },
    ],
  }
);

module.exports = Notification;