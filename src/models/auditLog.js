const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const AuditLog = sequelize.define(
  "AuditLog",
  {
    log_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "users", key: "user_id" },
    },

    action_type: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: "user.login, order.created, inventory.updated",
    },

    table_name: {
      type: DataTypes.STRING(100),
    },

    record_id: {
      type: DataTypes.INTEGER,
    },

    action: {
      type: DataTypes.ENUM("create", "read", "update", "delete"),
      allowNull: false,
    },

    old_values: {
      type: DataTypes.JSON,
    },

    new_values: {
      type: DataTypes.JSON,
    },

    ip_address: {
      type: DataTypes.STRING(45),
    },

    user_agent: {
      type: DataTypes.TEXT,
    },

    device_info: {
      type: DataTypes.JSON,
    },
  },
  {
    tableName: "audit_logs",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false,
    indexes: [
      { name: "idx_user", fields: ["user_id"] },
      { name: "idx_action", fields: ["action_type"] },
      { name: "idx_table", fields: ["table_name"] },
      { name: "idx_record", fields: ["record_id"] },
      { name: "idx_created_date", fields: ["created_at"] },
    ],
  }
);

module.exports = AuditLog;