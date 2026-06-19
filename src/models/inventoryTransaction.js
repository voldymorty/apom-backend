const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const InventoryTransaction = sequelize.define(
  "InventoryTransaction",
  {
    transaction_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    inventory_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "inventory", key: "inventory_id" },
    },

    transaction_type: {
      type: DataTypes.ENUM(
        "stock_in",
        "stock_out",
        "adjustment",
        "return",
        "wastage"
      ),
      allowNull: false,
    },

    quantity_kg: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },

    reference_type: {
      type: DataTypes.ENUM("pickup", "order", "manual", "return"),
      allowNull: false,
    },

    reference_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Links to pickup_deliveries or orders",
    },

    previous_quantity: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },

    new_quantity: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },

    performed_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "users", key: "user_id" },
    },

    remarks: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "inventory_transactions",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false,
    indexes: [
      { name: "idx_inventory", fields: ["inventory_id"] },
      { name: "idx_reference", fields: ["reference_type", "reference_id"] },
      { name: "idx_created_date", fields: ["created_at"] },
      { name: "idx_type", fields: ["transaction_type"] },
    ],
  }
);

module.exports = InventoryTransaction;