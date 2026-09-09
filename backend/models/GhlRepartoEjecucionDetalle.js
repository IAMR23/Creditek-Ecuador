const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const GhlRepartoEjecucionDetalle = sequelize.define("GhlRepartoEjecucionDetalle", {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  ejecucionId: { type: DataTypes.BIGINT, allowNull: false },
  opportunityId: { type: DataTypes.STRING(100), allowNull: false },
  previousAssignedTo: { type: DataTypes.STRING(100), allowNull: true },
  newAssignedTo: { type: DataTypes.STRING(100), allowNull: true },
  estado: { type: DataTypes.ENUM("pending", "assigned", "skipped", "error", "cancelled"), allowNull: false, defaultValue: "pending" },
  retryable: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  attemptCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  assignedAt: { type: DataTypes.DATE, allowNull: true },
  errorCode: { type: DataTypes.STRING(80), allowNull: true },
  errorMessage: { type: DataTypes.TEXT, allowNull: true },
}, { tableName: "ghl_reparto_ejecucion_detalles", timestamps: true });

module.exports = GhlRepartoEjecucionDetalle;
