// models/State.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const State = sequelize.define("State", {
  state_id:   { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  state_name: { type: DataTypes.STRING(100), allowNull: false },
  state_code: { type: DataTypes.STRING(10), allowNull: true },
}, { tableName: "states", timestamps: false });

module.exports = State;