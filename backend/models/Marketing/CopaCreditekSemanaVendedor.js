const { DataTypes } = require("sequelize");
const { sequelize } = require("../../config/db");

const CopaCreditekSemanaVendedor = sequelize.define(
  "CopaCreditekSemanaVendedor",
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
      onDelete: "CASCADE",
    },
    fechaInicio: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    fechaFin: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    meta: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: { min: 0, isInt: true },
    },
    ventasManual: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: { min: 0, isInt: true },
    },
  },
  {
    tableName: "copa_creditek_semanas_vendedores",
    timestamps: true,
    indexes: [
      {
        name: "copa_creditek_semana_vendedor_periodo_uidx",
        unique: true,
        fields: ["usuarioId", "fechaInicio", "fechaFin"],
      },
      {
        name: "copa_creditek_semana_periodo_idx",
        fields: ["fechaInicio", "fechaFin"],
      },
    ],
  },
);

module.exports = CopaCreditekSemanaVendedor;
