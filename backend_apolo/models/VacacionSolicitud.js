const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const VacacionSolicitud = sequelize.define("VacacionSolicitud", {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  usuarioId: { type: DataTypes.INTEGER, allowNull: false, references: { model: "usuarios", key: "id" } },
  agenciaId: { type: DataTypes.INTEGER, allowNull: false, references: { model: "agencias", key: "id" } },
  cantidadDias: { type: DataTypes.DECIMAL(8, 2), allowNull: false },
  fechaInicio: { type: DataTypes.DATEONLY, allowNull: false },
  fechaFin: { type: DataTypes.DATEONLY, allowNull: false },
  fechaReincorporacion: { type: DataTypes.DATEONLY, allowNull: false },
  observacion: { type: DataTypes.TEXT, allowNull: true },
  reemplazoUsuarioId: { type: DataTypes.INTEGER, allowNull: true, references: { model: "usuarios", key: "id" } },
  estado: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "PENDIENTE", validate: { isIn: [["PENDIENTE", "APROBADA", "RECHAZADA", "CANCELADA"]] } },
  motivoPrioridad: { type: DataTypes.TEXT, allowNull: true },
  motivoDecision: { type: DataTypes.TEXT, allowNull: true },
  autorId: { type: DataTypes.INTEGER, allowNull: false, references: { model: "usuarios", key: "id" } },
  aprobadorId: { type: DataTypes.INTEGER, allowNull: true, references: { model: "usuarios", key: "id" } },
  fechaAprobacion: { type: DataTypes.DATE, allowNull: true },
  fechaDecision: { type: DataTypes.DATE, allowNull: true },
  idempotenciaKey: { type: DataTypes.STRING(100), allowNull: true, unique: true },
  version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
}, { tableName: "vacacion_solicitudes", timestamps: true });

module.exports = VacacionSolicitud;
