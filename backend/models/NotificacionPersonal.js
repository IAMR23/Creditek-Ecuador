const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const NotificacionPersonal = sequelize.define(
  "NotificacionPersonal",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    claveEvento: {
      type: DataTypes.STRING(160),
      allowNull: false,
      unique: true,
    },
    tipo: {
      type: DataTypes.STRING(40),
      allowNull: false,
    },
    titulo: {
      type: DataTypes.STRING(160),
      allowNull: false,
    },
    mensaje: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    usuarioReferenciaId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    nombreReferencia: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    fechaReferencia: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    fechaEvento: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    prioridad: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "info",
    },
    origen: {
      type: DataTypes.STRING(80),
      allowNull: true,
    },
  },
  {
    tableName: "notificaciones_personal",
    timestamps: true,
    indexes: [
      { unique: true, fields: ["claveEvento"] },
      { fields: ["fechaEvento"] },
      { fields: ["tipo"] },
      { fields: ["createdAt"] },
    ],
  },
);

module.exports = NotificacionPersonal;
