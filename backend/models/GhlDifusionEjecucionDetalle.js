const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const GhlDifusionEjecucionDetalle = sequelize.define("GhlDifusionEjecucionDetalle", {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  ejecucionId: { type: DataTypes.BIGINT, allowNull: false },
  contactId: { type: DataTypes.STRING(100), allowNull: false },
  contactName: { type: DataTypes.STRING(250), allowNull: false },
  instanceIndex: { type: DataTypes.INTEGER, allowNull: false },
  mensaje: { type: DataTypes.TEXT, allowNull: true },
  estado: { type: DataTypes.STRING(30), allowNull: false, defaultValue: "pending" },
  messageId: { type: DataTypes.STRING(150), allowNull: true },
  sendError: { type: DataTypes.TEXT, allowNull: true },
  tagStatus: { type: DataTypes.STRING(30), allowNull: false, defaultValue: "pending" },
  tagError: { type: DataTypes.TEXT, allowNull: true },
  processedAt: { type: DataTypes.DATE, allowNull: true },
}, {
  tableName: "ghl_difusion_ejecucion_detalles",
  timestamps: true,
  indexes: [
    { unique: true, fields: ["ejecucionId", "contactId"] },
    { fields: ["ejecucionId", "estado"] },
  ],
});

module.exports = GhlDifusionEjecucionDetalle;
