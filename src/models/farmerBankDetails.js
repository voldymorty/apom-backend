const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const FarmerBankDetails = sequelize.define(
  "FarmerBankDetails",
  {
    bank_detail_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    farmer_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      references: { model: "farmers", key: "farmer_id" },
    },

    account_holder_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },

    bank_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },

    account_number: {
      type: DataTypes.STRING(30),
      allowNull: false,
    },

    ifsc_code: {
      type: DataTypes.STRING(11),
      allowNull: false,
    },

    branch_name: {
      type: DataTypes.STRING(100),
    },

    account_type: {
      type: DataTypes.ENUM("savings", "current"),
      defaultValue: "savings",
    },

    upi_id: {
      type: DataTypes.STRING(100),
    },

    is_verified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },

    verified_at: {
      type: DataTypes.DATE,
    },

    is_primary: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    tableName: "farmer_bank_details",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      { name: "idx_farmer", fields: ["farmer_id"] },
      { name: "idx_verified", fields: ["is_verified"] },
    ],
  }
);

module.exports = FarmerBankDetails;