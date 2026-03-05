// models/CierreCaja/Denominacion.js
const { DataTypes } = require("sequelize");
const { sequelize } = require("../../config/db");

const Denominacion = sequelize.define(
  "Denominacion",
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

    valor: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },

    cantidad: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    tableName: "denominaciones",
    timestamps: false,
  },
);

module.exports = Denominacion;