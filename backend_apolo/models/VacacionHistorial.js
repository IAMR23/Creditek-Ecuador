const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const VacacionHistorial = sequelize.define("VacacionHistorial", {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  solicitudId: { type: DataTypes.BIGINT, allowNull: false, references: { model: "vacacion_solicitudes", key: "id" } },
  accion: { type: DataTypes.STRING(40), allowNull: false },
  estadoAnterior: { type: DataTypes.STRING(20), allowNull: true },
  estadoNuevo: { type: DataTypes.STRING(20), allowNull: false },
  motivo: { type: DataTypes.TEXT, allowNull: true },
  datos: { type: DataTypes.JSONB, allowNull: true },
  actorId: { type: DataTypes.INTEGER, allowNull: false, references: { model: "usuarios", key: "id" } },
}, { tableName: "vacacion_historial", timestamps: true, updatedAt: false });

module.exports = VacacionHistorial;
