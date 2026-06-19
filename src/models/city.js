// models/City.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const City = sequelize.define("City", {
  city_id:     { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  city_name:   { type: DataTypes.STRING(100), allowNull: false },
  district_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: "districts", key: "district_id" } },
}, { tableName: "cities", timestamps: false });

module.exports = City;