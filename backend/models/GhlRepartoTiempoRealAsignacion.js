const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const GhlRepartoTiempoRealAsignacion = sequelize.define(
  "GhlRepartoTiempoRealAsignacion",
  {
    id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
    opportunityId: { type: DataTypes.STRING(100), allowNull: false },
    ghlUserId: { type: DataTypes.STRING(100), allowNull: false },
    pipelineId: { type: DataTypes.STRING(100), allowNull: false },
    stageId: { type: DataTypes.STRING(100), allowNull: false },
    trigger: { type: DataTypes.STRING(30), allowNull: false },
    assignedAt: { type: DataTypes.DATE, allowNull: false },
  },
  {
    tableName: "ghl_reparto_tiempo_real_asignaciones",
    timestamps: true,
    indexes: [
      {
        name: "ghl_reparto_tiempo_real_asesor_fecha_idx",
        fields: ["ghlUserId", "assignedAt"],
      },
      {
        name: "ghl_reparto_tiempo_real_oportunidad_fecha_idx",
        fields: ["opportunityId", "assignedAt"],
      },
    ],
  },
);

module.exports = GhlRepartoTiempoRealAsignacion;
