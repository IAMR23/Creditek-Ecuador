const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const Modelo = require("./Modelo");

const PrecioVenta = sequelize.define(
  "PrecioVenta",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    marca: {
      type: DataTypes.STRING(80),
      allowNull: false,
    },
    nombre: {
      type: DataTypes.STRING(160),
      allowNull: false,
    },
    modeloId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: Modelo,
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
    pvpCredito: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    pvpContado: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    pvpTarjetaCredito: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    activo: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    timestamps: true,
    tableName: "precios_venta",
  },
);

module.exports = PrecioVenta;
