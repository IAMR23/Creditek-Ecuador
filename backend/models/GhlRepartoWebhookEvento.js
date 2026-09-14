const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const GhlRepartoWebhookEvento = sequelize.define("GhlRepartoWebhookEvento", {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  idempotencyKey: { type: DataTypes.STRING(64), allowNull: false },
  estado: { type: DataTypes.STRING(24), allowNull: false, defaultValue: "received" },
  resultCode: { type: DataTypes.STRING(80), allowNull: true },
  configuracionId: { type: DataTypes.INTEGER, allowNull: true },
  opportunityId: { type: DataTypes.STRING(100), allowNull: true },
  contactId: { type: DataTypes.STRING(100), allowNull: true },
  locationId: { type: DataTypes.STRING(100), allowNull: true },
  workflowId: { type: DataTypes.STRING(100), allowNull: true },
  source: { type: DataTypes.STRING(120), allowNull: true },
  attemptCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  lockedAt: { type: DataTypes.DATE, allowNull: true },
  processedAt: { type: DataTypes.DATE, allowNull: true },
  lastError: { type: DataTypes.TEXT, allowNull: true },
}, {
  tableName: "ghl_reparto_webhook_eventos",
  timestamps: true,
  indexes: [
    { name: "ghl_reparto_webhook_eventos_idempotency_unique", unique: true, fields: ["idempotencyKey"] },
    { name: "ghl_reparto_webhook_eventos_estado_fecha_idx", fields: ["estado", "createdAt"] },
  ],
});

module.exports = GhlRepartoWebhookEvento;
