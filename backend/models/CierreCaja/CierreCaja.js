// models/CierreCaja/CierreCaja.js
const { DataTypes } = require("sequelize");
const { sequelize } = require("../../config/db");

const CierreCaja = sequelize.define(
  "CierreCaja",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    fecha: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },

    usuarioId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    observacion: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    totalFisico: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },

    totalEfectivo: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },

    totalTransferencia: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },

    totalPendiente: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },

    totalSistema: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },

    diferencia: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },

    estado: {
      type: DataTypes.ENUM("CUADRADO", "DESCUADRADO"),
      allowNull: false,
      defaultValue: "CUADRADO",
    },
  },
  {
    tableName: "cierre_caja",
    timestamps: true,
  },
);

module.exports = CierreCaja;