// models/CierreCaja/MovimientoCaja.js
const { DataTypes } = require("sequelize");
const { sequelize } = require("../../config/db");

const MovimientoCaja = sequelize.define(
  "MovimientoCaja",
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

    responsable: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    detalle: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    entidad: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    valor: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },

    formaPago: {
      type: DataTypes.ENUM("EFECTIVO", "TRANSFERENCIA", "PENDIENTE"),
      allowNull: false,
    },

    recibo: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    observacion: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    tableName: "movimientos_caja",
    timestamps: true,
  },
);

module.exports = MovimientoCaja;    