const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const GhlRepartoEjecucion = sequelize.define("GhlRepartoEjecucion", {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  configuracionId: { type: DataTypes.INTEGER, allowNull: false },
  tipo: { type: DataTypes.ENUM("scheduled", "manual"), allowNull: false },
  scheduledFor: { type: DataTypes.DATE, allowNull: true },
  ventanaProgramada: { type: DataTypes.STRING(20), allowNull: true },
  startedAt: { type: DataTypes.DATE, allowNull: false },
  finishedAt: { type: DataTypes.DATE, allowNull: true },
  estado: { type: DataTypes.ENUM("running", "pause_requested", "paused", "cancel_requested", "completed", "partial", "failed", "cancelled", "interrupted", "skipped"), allowNull: false },
  pipelineNombre: { type: DataTypes.STRING(200), allowNull: false },
  stageNombre: { type: DataTypes.STRING(200), allowNull: false },
  totalEncontradas: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  totalElegibles: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  totalAsignadas: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  totalOmitidas: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  totalErrores: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  ejecutadoPorId: { type: DataTypes.INTEGER, allowNull: true },
  errorGeneral: { type: DataTypes.TEXT, allowNull: true },
  pauseRequestedAt: { type: DataTypes.DATE, allowNull: true },
  pausedAt: { type: DataTypes.DATE, allowNull: true },
  resumedAt: { type: DataTypes.DATE, allowNull: true },
  cancelRequestedAt: { type: DataTypes.DATE, allowNull: true },
  cancelledAt: { type: DataTypes.DATE, allowNull: true },
  heartbeatAt: { type: DataTypes.DATE, allowNull: true },
  processedCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
}, { tableName: "ghl_reparto_ejecuciones", timestamps: true, indexes: [
  { unique: true, fields: ["configuracionId", "ventanaProgramada"], where: { ventanaProgramada: { [require("sequelize").Op.ne]: null } } },
  { unique: true, fields: ["configuracionId"], where: { estado: { [require("sequelize").Op.in]: ["running", "pause_requested", "paused", "cancel_requested"] } }, name: "ghl_reparto_ejecucion_activa_unique" },
  { fields: ["configuracionId", "startedAt"] },
] });

module.exports = GhlRepartoEjecucion;
