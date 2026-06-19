// models/District.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const District = sequelize.define("District", {
  district_id:   { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  district_name: { type: DataTypes.STRING(100), allowNull: false },
  state_id:      { type: DataTypes.INTEGER, allowNull: false, references: { model: "states", key: "state_id" } },
}, { tableName: "districts", timestamps: false });

module.exports = District;