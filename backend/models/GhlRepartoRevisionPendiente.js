const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const GhlRepartoRevisionPendiente = sequelize.define(
  "GhlRepartoRevisionPendiente",
  {
    locationId: { type: DataTypes.STRING(100), primaryKey: true },
    requestedVersion: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0 },
    processedVersion: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0 },
    lastTrigger: { type: DataTypes.STRING(30), allowNull: false, defaultValue: "play" },
    requestedAt: { type: DataTypes.DATE, allowNull: false },
    processedAt: { type: DataTypes.DATE, allowNull: true },
    failureCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    retryAfter: { type: DataTypes.DATE, allowNull: true },
    lastFailureCode: { type: DataTypes.STRING(80), allowNull: true },
  },
  {
    tableName: "ghl_reparto_revisiones_pendientes",
    timestamps: true,
  },
);

module.exports = GhlRepartoRevisionPendiente;
