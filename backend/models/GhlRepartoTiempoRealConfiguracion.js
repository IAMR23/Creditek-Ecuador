const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const GhlRepartoTiempoRealConfiguracion = sequelize.define(
  "GhlRepartoTiempoRealConfiguracion",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      defaultValue: 1,
      validate: { isIn: [[1]] },
    },
    pipelineId: { type: DataTypes.STRING(100), allowNull: true },
    pipelineNombre: { type: DataTypes.STRING(200), allowNull: true },
    stageIds: { type: DataTypes.ARRAY(DataTypes.STRING(100)), allowNull: false, defaultValue: [] },
    stageNombres: { type: DataTypes.ARRAY(DataTypes.STRING(200)), allowNull: false, defaultValue: [] },
    maxPendientesPorAsesor: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 2,
      validate: { isInt: true, min: 1, max: 1000 },
    },
    indiceSiguienteUsuario: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    horaPausaAutomatica: {
      type: DataTypes.STRING(5),
      allowNull: false,
      defaultValue: "18:00",
      validate: { is: /^([01]\d|2[0-3]):[0-5]\d$/ },
    },
    actualizadoPorId: { type: DataTypes.INTEGER, allowNull: true },
    activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  },
  {
    tableName: "ghl_reparto_tiempo_real_configuraciones",
    timestamps: true,
  },
);

module.exports = GhlRepartoTiempoRealConfiguracion;
