const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const VacacionPago = sequelize.define("VacacionPago", {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  usuarioId: { type: DataTypes.INTEGER, allowNull: false, references: { model: "usuarios", key: "id" } },
  concepto: { type: DataTypes.STRING(40), allowNull: false, validate: { isIn: [["REMUNERACION_DESCANSO", "COMPENSACION_ANTIGUEDAD", "LIQUIDACION_TERMINACION", "HISTORICO_REVISION"]] } },
  fundamento: { type: DataTypes.TEXT, allowNull: false },
  dias: { type: DataTypes.DECIMAL(8, 2), allowNull: false, defaultValue: 0 },
  baseCalculo: { type: DataTypes.DECIMAL(14, 2), allowNull: true },
  monto: { type: DataTypes.DECIMAL(14, 2), allowNull: false },
  fechaPago: { type: DataTypes.DATEONLY, allowNull: true },
  medio: { type: DataTypes.STRING(80), allowNull: true },
  referencia: { type: DataTypes.STRING(120), allowNull: true },
  soporte: { type: DataTypes.TEXT, allowNull: true },
  estado: { type: DataTypes.STRING(30), allowNull: false, defaultValue: "PENDIENTE_PAGO", validate: { isIn: [["PENDIENTE_PAGO", "PAGADO", "ANULADO"]] } },
  autorId: { type: DataTypes.INTEGER, allowNull: false, references: { model: "usuarios", key: "id" } },
  aprobadorId: { type: DataTypes.INTEGER, allowNull: true, references: { model: "usuarios", key: "id" } },
  pagadorId: { type: DataTypes.INTEGER, allowNull: true, references: { model: "usuarios", key: "id" } },
  fechaAprobacion: { type: DataTypes.DATE, allowNull: true },
  idempotenciaKey: { type: DataTypes.STRING(100), allowNull: true, unique: true },
}, { tableName: "vacacion_pagos", timestamps: true });

module.exports = VacacionPago;
