const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const VacacionPagoPeriodo = sequelize.define("VacacionPagoPeriodo", {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  pagoId: { type: DataTypes.BIGINT, allowNull: false, references: { model: "vacacion_pagos", key: "id" } },
  periodoId: { type: DataTypes.INTEGER, allowNull: false, references: { model: "vacacion_periodos", key: "id" } },
  dias: { type: DataTypes.DECIMAL(8, 2), allowNull: false },
}, { tableName: "vacacion_pago_periodos", timestamps: true, updatedAt: false, indexes: [{ unique: true, fields: ["pagoId", "periodoId"] }] });

module.exports = VacacionPagoPeriodo;
