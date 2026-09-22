const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const GhlWorkflowEjecucion = sequelize.define("GhlWorkflowEjecucion", {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  configuracionId: { type: DataTypes.INTEGER, allowNull: false },
  ventanaProgramada: { type: DataTypes.STRING(80), allowNull: false },
  tipo: { type: DataTypes.ENUM("scheduled", "manual"), allowNull: false, defaultValue: "scheduled" },
  estado: {
    type: DataTypes.ENUM("pending", "running", "completed", "partial", "failed", "interrupted", "cancelled"),
    allowNull: false,
    defaultValue: "pending",
  },
  scheduledFor: { type: DataTypes.DATE, allowNull: false },
  fechaLocal: { type: DataTypes.DATEONLY, allowNull: false },
  startedAt: { type: DataTypes.DATE, allowNull: true },
  finishedAt: { type: DataTypes.DATE, allowNull: true },
  heartbeatAt: { type: DataTypes.DATE, allowNull: true },
  totalEncontrado: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  totalElegible: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  totalDeduplicado: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  totalProcesado: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  totalOmitido: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  totalFallido: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  paginasConsultadas: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  codigoGeneral: { type: DataTypes.STRING(80), allowNull: true },
  mensajeGeneral: { type: DataTypes.TEXT, allowNull: true },
}, {
  tableName: "ghl_workflow_ejecuciones",
  timestamps: true,
  indexes: [
    { unique: true, fields: ["configuracionId", "ventanaProgramada"], name: "ghl_workflow_ejecucion_ventana_unique" },
    { fields: ["estado", "heartbeatAt"] },
    { fields: ["configuracionId", "scheduledFor"] },
  ],
});

module.exports = GhlWorkflowEjecucion;
