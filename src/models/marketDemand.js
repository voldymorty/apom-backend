const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const MarketDemand = sequelize.define(
  "MarketDemand",
  {
    demand_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    month: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { min: 1, max: 12 },
      comment: "Month number 1-12",
    },
    crop_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    demand_ratio: {
      type: DataTypes.DECIMAL(4, 2),
      allowNull: false,
      comment: "Demand ratio e.g. 0.50 = 50%",
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    tableName: "market_demands",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      { name: "idx_demand_month", fields: ["month"] },
      { name: "idx_demand_crop", fields: ["crop_name"] },
    ],
  }
);

module.exports = MarketDemand;