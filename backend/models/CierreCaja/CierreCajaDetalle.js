const { DataTypes } = require("sequelize");
const { sequelize } = require("../../config/db");

const CierreCajaDetalle = sequelize.define(
  "CierreCajaDetalle",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    cierreCajaId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    denominacion: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },

    cantidad: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    total: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
  },
  {
    timestamps: false,
    tableName: "cierre_caja_detalle",
  }
);

module.exports = CierreCajaDetalle;
