const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const UphoneSolicitud = sequelize.define(
  "UphoneSolicitud",
  {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },
    numeroSolicitud: {
      type: DataTypes.STRING(40),
      allowNull: false,
      unique: "uphone_solicitudes_numero_solicitud_unique",
    },
    distribuidor: { type: DataTypes.STRING(180), allowNull: true },
    matriz: { type: DataTypes.STRING(180), allowNull: true },
    vendedor: { type: DataTypes.STRING(220), allowNull: true },
    usuario: { type: DataTypes.STRING(100), allowNull: true },
    cedula: { type: DataTypes.STRING(30), allowNull: true },
    cedulaNormalizada: { type: DataTypes.STRING(30), allowNull: true },
    cliente: { type: DataTypes.STRING(220), allowNull: true },
    telefonoSolicitud: { type: DataTypes.STRING(30), allowNull: true },
    telefonoContrato: { type: DataTypes.STRING(30), allowNull: true },
    fechaSolicitud: { type: DataTypes.DATE, allowNull: true },
    fechaContrato: { type: DataTypes.STRING(40), allowNull: true },
    grupoArrendamiento: { type: DataTypes.STRING(160), allowNull: true },
    estado: { type: DataTypes.STRING(80), allowNull: true },
    estadoContrato: { type: DataTypes.STRING(120), allowNull: true },
    archivoOrigen: { type: DataTypes.STRING(255), allowNull: false },
    importadoPorId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "usuarios", key: "id" },
    },
  },
  {
    tableName: "uphone_solicitudes",
    timestamps: true,
    indexes: [
      { name: "uphone_solicitudes_fecha_idx", fields: ["fechaSolicitud"] },
      { name: "uphone_solicitudes_estado_idx", fields: ["estado"] },
      { name: "uphone_solicitudes_vendedor_idx", fields: ["vendedor"] },
      { name: "uphone_solicitudes_created_at_idx", fields: ["createdAt"] },
      {
        name: "uphone_solicitudes_cedula_normalizada_unique",
        unique: true,
        fields: ["cedulaNormalizada"],
      },
    ],
  },
);

module.exports = UphoneSolicitud;
