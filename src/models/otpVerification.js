const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const OtpVerification = sequelize.define(
  "OtpVerification",
  {
    otp_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    mobile_number: {
      type: DataTypes.STRING(15),
      allowNull: false,
    },

    otp_code: {
      type: DataTypes.STRING(4),
      allowNull: false,
    },

    otp_type: {
      type: DataTypes.ENUM(
        "registration",
        "login",
        "delivery",
        "pickup",
        "transaction"
      ),
      allowNull: false,
    },

    role: {
      type: DataTypes.ENUM("farmer", "vendor", "delivery"),
      allowNull: true,
      comment: "User role captured during OTP request",
    },

    reference_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: "Links to user_id, order_id, delivery_id, etc.",
    },

    is_verified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },

    verified_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },

    attempts: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      comment: "Number of failed verification attempts",
    },

    max_attempts: {
      type: DataTypes.INTEGER,
      defaultValue: 3,
    },

    is_expired: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },

    created_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "otp_verifications",

    timestamps: false,

    indexes: [
      {
        name: "idx_mobile_type",
        fields: ["mobile_number", "otp_type"],
      },
      {
        name: "idx_reference",
        fields: ["reference_id"],
      },
      {
        name: "idx_expires",
        fields: ["expires_at"],
      },
      {
        name: "idx_verified",
        fields: ["is_verified"],
      },
    ],
  }
);

module.exports = OtpVerification;