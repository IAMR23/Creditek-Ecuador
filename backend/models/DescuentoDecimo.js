const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const DescuentoDecimo = sequelize.define(
  "DescuentoDecimo",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    usuarioId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "usuarios", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },
    anio: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { min: 2000, max: 2100 },
    },
    valor: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      validate: { min: 0 },
    },
    decimoCuarto: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    decimoTercero: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    vacaciones: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    observaciones: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: "",
    },
    actualizadoPorId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "usuarios", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
  },
  {
    tableName: "descuentos_decimos",
    timestamps: true,
    indexes: [
      {
        name: "descuentos_decimos_usuario_anio_unique",
        unique: true,
        fields: ["usuarioId", "anio"],
      },
      {
        name: "descuentos_decimos_anio_idx",
        fields: ["anio"],
      },
    ],
  },
);

module.exports = DescuentoDecimo;
