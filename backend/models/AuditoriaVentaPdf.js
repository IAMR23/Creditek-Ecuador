const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const AuditoriaVentaPdf = sequelize.define(
  "AuditoriaVentaPdf",
  {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    tipo: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    fechaInicio: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    fechaFin: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    origen: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: "MANUAL",
    },
    estado: {
      type: DataTypes.STRING(40),
      allowNull: false,
      defaultValue: "COMPLETADA",
    },
    registrosPdf: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    resultados: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    resumen: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    errores: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
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
    controlFinancieroCargaId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "control_financiero_cargas",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
  },
  {
    tableName: "auditorias_ventas_pdf",
    timestamps: true,
    indexes: [
      {
        name: "auditorias_ventas_pdf_tipo_fechas_idx",
        fields: ["tipo", "fechaInicio", "fechaFin", "updatedAt"],
      },
      {
        name: "auditorias_ventas_pdf_carga_tipo_unique",
        unique: true,
        fields: ["controlFinancieroCargaId", "tipo"],
      },
    ],
  },
);

module.exports = AuditoriaVentaPdf;
