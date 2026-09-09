const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const GhlAsesorDisponibilidadHistorial = sequelize.define(
  "GhlAsesorDisponibilidadHistorial",
  {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    vinculoId: { type: DataTypes.INTEGER, allowNull: false },
    usuarioId: { type: DataTypes.INTEGER, allowNull: false },
    ghlUserId: { type: DataTypes.STRING(100), allowNull: false },
    accion: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "ESTADO",
      validate: { isIn: [["ESTADO", "ASOCIACION"]] },
    },
    estadoAnterior: { type: DataTypes.STRING(10), allowNull: true },
    estadoNuevo: { type: DataTypes.STRING(10), allowNull: false },
    cambiadoPorId: { type: DataTypes.INTEGER, allowNull: true },
    motivoCambio: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: { isIn: [["asesor", "administrador"]] },
    },
    fechaLocal: { type: DataTypes.DATEONLY, allowNull: false },
    metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  },
  {
    tableName: "ghl_asesor_disponibilidad_historial",
    timestamps: true,
    indexes: [
      { fields: ["usuarioId", "createdAt"] },
      { fields: ["ghlUserId", "createdAt"] },
    ],
  },
);

module.exports = GhlAsesorDisponibilidadHistorial;
