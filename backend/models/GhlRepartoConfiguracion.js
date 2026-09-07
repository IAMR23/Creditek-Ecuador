const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const GhlRepartoConfiguracion = sequelize.define("GhlRepartoConfiguracion", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nombre: { type: DataTypes.STRING(160), allowNull: false },
  pipelineId: { type: DataTypes.STRING(100), allowNull: false },
  pipelineNombre: { type: DataTypes.STRING(200), allowNull: false },
  stageId: { type: DataTypes.STRING(100), allowNull: false },
  stageNombre: { type: DataTypes.STRING(200), allowNull: false },
  hora: { type: DataTypes.STRING(5), allowNull: false },
  zonaHoraria: { type: DataTypes.STRING(50), allowNull: false, defaultValue: "America/Guayaquil" },
  diasSemana: { type: DataTypes.ARRAY(DataTypes.INTEGER), allowNull: false },
  modo: { type: DataTypes.ENUM("unassigned", "all"), allowNull: false },
  usuariosGhl: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
  activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  indiceSiguienteUsuario: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  creadoPorId: { type: DataTypes.INTEGER, allowNull: false },
  actualizadoPorId: { type: DataTypes.INTEGER, allowNull: false },
}, { tableName: "ghl_reparto_configuraciones", timestamps: true });

module.exports = GhlRepartoConfiguracion;
