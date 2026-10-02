const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const GhlDifusionEjecucion = sequelize.define("GhlDifusionEjecucion", {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  estado: { type: DataTypes.STRING(30), allowNull: false, defaultValue: "pending" },
  mensaje: { type: DataTypes.TEXT, allowNull: false },
  mensajes: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
  instanceIndexes: { type: DataTypes.ARRAY(DataTypes.INTEGER), allowNull: false },
  batchSize: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 3 },
  intervalMinutes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 5 },
  tagName: { type: DataTypes.STRING(100), allowNull: false, defaultValue: "regestion" },
  total: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  processed: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  sent: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  failed: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  tagged: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  tagFailed: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  excluded: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
  creadoPorId: { type: DataTypes.INTEGER, allowNull: false },
  scheduledAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  startedAt: { type: DataTypes.DATE, allowNull: true },
  finishedAt: { type: DataTypes.DATE, allowNull: true },
  nextBatchAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  heartbeatAt: { type: DataTypes.DATE, allowNull: true },
}, {
  tableName: "ghl_difusion_ejecuciones",
  timestamps: true,
  indexes: [
    { fields: ["estado", "nextBatchAt"] },
    { fields: ["creadoPorId", "createdAt"] },
  ],
});

module.exports = GhlDifusionEjecucion;
