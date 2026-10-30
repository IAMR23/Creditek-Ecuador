const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const VacacionSolicitudPeriodo = sequelize.define("VacacionSolicitudPeriodo", {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  solicitudId: { type: DataTypes.BIGINT, allowNull: false, references: { model: "vacacion_solicitudes", key: "id" } },
  periodoId: { type: DataTypes.INTEGER, allowNull: false, references: { model: "vacacion_periodos", key: "id" } },
  dias: { type: DataTypes.DECIMAL(8, 2), allowNull: false },
  orden: { type: DataTypes.INTEGER, allowNull: false },
}, { tableName: "vacacion_solicitud_periodos", timestamps: true, updatedAt: false, indexes: [{ unique: true, fields: ["solicitudId", "periodoId"] }] });

module.exports = VacacionSolicitudPeriodo;
