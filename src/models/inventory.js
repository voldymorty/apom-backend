const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Inventory = sequelize.define(
  "Inventory",
  {
    inventory_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
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

    available_quantity_kg: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },

    reserved_quantity_kg: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
      comment: "Reserved for pending orders",
    },

    total_quantity_kg: {
      type: DataTypes.VIRTUAL(DataTypes.DECIMAL(10, 2), [
        "available_quantity_kg",
        "reserved_quantity_kg",
      ]),
      get() {
        const available = parseFloat(this.getDataValue("available_quantity_kg") || 0);
        const reserved = parseFloat(this.getDataValue("reserved_quantity_kg") || 0);
        return available + reserved;
      },
    },

    warehouse_location: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },

    last_restocked_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    minimum_stock_alert: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 50,
    },
  },
  {
    tableName: "inventory",
    timestamps: false,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      { name: "idx_product", fields: ["product_id"] },
      { name: "idx_low_stock", fields: ["available_quantity_kg"] },
      { name: "idx_grade", fields: ["grade"] },
      { unique: true, name: "unique_product_grade", fields: ["product_id", "grade"] },
    ],
  }
);

module.exports = Inventory;