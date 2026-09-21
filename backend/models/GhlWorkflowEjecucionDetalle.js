const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const GhlWorkflowEjecucionDetalle = sequelize.define("GhlWorkflowEjecucionDetalle", {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  ejecucionId: { type: DataTypes.BIGINT, allowNull: false },
  configuracionId: { type: DataTypes.INTEGER, allowNull: false },
  contactId: { type: DataTypes.STRING(100), allowNull: false },
  opportunityId: { type: DataTypes.STRING(100), allowNull: true },
  workflowId: { type: DataTypes.STRING(100), allowNull: false },
  fechaLocal: { type: DataTypes.DATEONLY, allowNull: false },
  estado: {
    type: DataTypes.ENUM("pending", "success", "failed_retryable", "failed_final", "skipped"),
    allowNull: false,
    defaultValue: "pending",
  },
  intentos: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  processedAt: { type: DataTypes.DATE, allowNull: true },
  errorCode: { type: DataTypes.STRING(80), allowNull: true },
  mensaje: { type: DataTypes.TEXT, allowNull: true },
}, {
  tableName: "ghl_workflow_ejecucion_detalles",
  timestamps: true,
  indexes: [
    { unique: true, fields: ["ejecucionId", "contactId", "workflowId"], name: "ghl_workflow_detalle_contacto_unique" },
    { fields: ["configuracionId", "contactId", "workflowId", "estado"] },
    { fields: ["contactId", "workflowId", "fechaLocal", "estado"] },
  ],
});

module.exports = GhlWorkflowEjecucionDetalle;
