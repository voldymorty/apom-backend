const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const OrderItem = sequelize.define(
  "OrderItem",
  {
    order_item_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    order_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "orders", key: "order_id" },
    },

    product_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "products", key: "product_id" },
    },

    grade: {
      type: DataTypes.ENUM("A", "B", "C"),
      allowNull: false,
    },

    quantity_kg: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },

    price_per_kg: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },

    total_price: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
    },

    delivered_quantity_kg: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
    },

    status: {
      type: DataTypes.ENUM("pending", "confirmed", "delivered", "cancelled"),
      defaultValue: "pending",
    },
  },
  {
    tableName: "order_items",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: false,
    indexes: [
      { name: "idx_order", fields: ["order_id"] },
      { name: "idx_product", fields: ["product_id"] },
      { name: "idx_status", fields: ["status"] },
    ],
  }
);

module.exports = OrderItem;