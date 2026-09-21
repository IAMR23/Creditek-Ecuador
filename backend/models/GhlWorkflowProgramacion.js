const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const GhlWorkflowProgramacion = sequelize.define("GhlWorkflowProgramacion", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nombre: { type: DataTypes.STRING(160), allowNull: false },
  pipelineId: { type: DataTypes.STRING(100), allowNull: false },
  pipelineNombre: { type: DataTypes.STRING(200), allowNull: false },
  stageIds: { type: DataTypes.ARRAY(DataTypes.STRING(100)), allowNull: false },
  stageNombres: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
  workflowId: { type: DataTypes.STRING(100), allowNull: false },
  workflowNombre: { type: DataTypes.STRING(200), allowNull: false },
  hora: { type: DataTypes.STRING(5), allowNull: false },
  diasSemana: { type: DataTypes.ARRAY(DataTypes.INTEGER), allowNull: false },
  zonaHoraria: { type: DataTypes.STRING(50), allowNull: false, defaultValue: "America/Guayaquil" },
  permitirReingreso: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  creadoPorId: { type: DataTypes.INTEGER, allowNull: false },
  actualizadoPorId: { type: DataTypes.INTEGER, allowNull: false },
}, {
  tableName: "ghl_workflow_programaciones",
  timestamps: true,
  indexes: [{ fields: ["activo", "hora"] }],
});

module.exports = GhlWorkflowProgramacion;
