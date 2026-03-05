// models/CierreCaja/RetiroCaja.js
const { DataTypes } = require("sequelize");
const { sequelize } = require("../../config/db");

const RetiroCaja = sequelize.define(
  "RetiroCaja",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    cierreId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    monto: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },

    motivo: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    autorizadoPor: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    tableName: "retiros_caja",
    timestamps: false,
  },
);

module.exports = RetiroCaja;