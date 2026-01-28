// models/DetalleVenta.js
const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const Venta = require("./Venta");
const DispositivoMarca = require("./DispositivoMarca"); // Cambiado a DispositivoMarca
const Modelo = require("./Modelo");

const DetalleVenta = sequelize.define(
  "DetalleVenta",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    cantidad: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { min: 1 },
    },
    precioUnitario: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    precioVendedor: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    dispositivoMarcaId: {
      // Cambio importante
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: DispositivoMarca, key: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },

    margen: {
      type: DataTypes.DOUBLE,
      allowNull: false,
      defaultValue: 0,
    },

    modeloId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: Modelo, key: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },
    contrato: {
      type: DataTypes.STRING,
    },
    formaPagoId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    entrada: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    alcance: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    observacionDetalle: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    cierreCaja: {
      type: DataTypes.STRING,
      allowNull: true,
      field: "cierreCaja",
    },
    ventaId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Venta,
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },
  },
  {
    tableName: "detalle_ventas",
    timestamps: true,
  },
);

module.exports = DetalleVenta;
