const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const LogisticaMastherPhoneIngreso = sequelize.define(
  "LogisticaMastherPhoneIngreso",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    modeloId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "modelos", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },
    cantidad: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { isInt: true, min: 1 },
    },
    precioUnitario: {
      type: DataTypes.DECIMAL(16, 6),
      allowNull: true,
      validate: { min: 0.01 },
    },
    subtotal: {
      type: DataTypes.DECIMAL(20, 6),
      allowNull: true,
      validate: { min: 0 },
    },
    iva: {
      type: DataTypes.DECIMAL(20, 6),
      allowNull: true,
      validate: { min: 0 },
    },
    total: {
      type: DataTypes.DECIMAL(20, 6),
      allowNull: true,
      validate: { min: 0 },
    },
    fechaIngreso: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    bodega: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: { isIn: [["CREDITEK", "PROVEEDOR"]] },
    },
    registradoPorId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "usuarios", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
    actualizadoPorId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "usuarios", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
    requestKey: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
  },
  {
    tableName: "logistica_masther_phone_ingresos",
    timestamps: true,
    indexes: [
      {
        name: "logistica_masther_phone_ingresos_modelo_fecha_idx",
        fields: ["modeloId", "fechaIngreso"],
      },
      {
        name: "logistica_masther_phone_ingresos_request_key_uk",
        unique: true,
        fields: ["requestKey"],
      },
    ],
  },
);

module.exports = LogisticaMastherPhoneIngreso;
