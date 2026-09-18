const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const SistemaTicket = sequelize.define(
  "SistemaTicket",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    codigo: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true,
    },
    titulo: {
      type: DataTypes.STRING(180),
      allowNull: false,
    },
    descripcion: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    tipo: {
      type: DataTypes.STRING(30),
      allowNull: false,
    },
    proyecto: {
      type: DataTypes.STRING(30),
      allowNull: false,
    },
    areaSolicitante: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    solicitanteId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "usuarios", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },
    responsableId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "usuarios", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
    prioridad: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: "Media",
    },
    estado: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: "Solicitado",
    },
    fechaInicio: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    fechaEstimada: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    fechaFinalizacion: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    motivoEstado: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    ultimaModificacionUsuarioId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "usuarios", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },
    version: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    tableName: "sistemas_tickets",
    timestamps: true,
    indexes: [
      { unique: true, fields: ["codigo"] },
      { fields: ["solicitanteId", "createdAt"] },
      { fields: ["estado", "prioridad"] },
      { fields: ["responsableId", "estado"] },
      { fields: ["proyecto"] },
      { fields: ["createdAt"] },
      { fields: ["fechaInicio"] },
      { fields: ["fechaEstimada"] },
    ],
  },
);

module.exports = SistemaTicket;
