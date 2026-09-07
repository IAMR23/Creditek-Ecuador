const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
module.exports = sequelize.define('NominaNovedad', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  usuarioId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'usuarios', key: 'id' }, onDelete: 'RESTRICT' },
  tipo: { type: DataTypes.STRING(20), allowNull: false, validate: { isIn: [['MATERNIDAD', 'LACTANCIA']] } },
  fechaInicio: { type: DataTypes.DATEONLY, allowNull: false },
  fechaFin: { type: DataTypes.DATEONLY, allowNull: false },
  fechaRetorno: { type: DataTypes.DATEONLY, allowNull: true },
  porcentajeEmpleador: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 25 },
  porcentajeIess: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 75 },
  // Historial de ajustes antiguos. El cálculo actual usa únicamente las fechas.
  ajustesMensuales: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  observacion: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
  activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  creadoPorId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'usuarios', key: 'id' }, onDelete: 'RESTRICT' },
  actualizadoPorId: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'usuarios', key: 'id' }, onDelete: 'RESTRICT' },
}, { tableName: 'nomina_novedades', timestamps: true, indexes: [{ fields: ['usuarioId', 'activo', 'fechaInicio', 'fechaFin'] }] });
