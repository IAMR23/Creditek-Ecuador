const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const ControlFinancieroCarga = sequelize.define(
  "ControlFinancieroCarga",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    archivoGenerado: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    fechaReporte: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    registrosCaja: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    registrosVentasTv: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    registrosVentasCelular: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    totalPagosCaja: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
      defaultValue: 0,
    },
    totalVentasTv: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
      defaultValue: 0,
    },
    totalEntradasTv: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
      defaultValue: 0,
    },
    totalVentasCelular: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
      defaultValue: 0,
    },
    totalEntradasCelular: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
      defaultValue: 0,
    },
    usuarioId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "usuarios",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
  },
  {
    tableName: "control_financiero_cargas",
    timestamps: true,
    indexes: [
      { name: "control_financiero_cargas_fecha_idx", fields: ["createdAt"] },
      {
        name: "control_financiero_cargas_fecha_reporte_idx",
        fields: ["fechaReporte"],
      },
      { name: "control_financiero_cargas_usuario_idx", fields: ["usuarioId"] },
    ],
  },
);

module.exports = ControlFinancieroCarga;
