const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const Postulacion = sequelize.define(
  "Postulacion",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    nombre: {
      type: DataTypes.STRING,
      allowNull: true, 
    },
    cedula: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    telefono: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    leida: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    leidaAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    observacion: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    pasaEntrevista: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    pasaEntrevistaAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    fechaEntrevista: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    estadoEntrevista: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "PENDIENTE",
    },
    entrevistaDuracionMinutos: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    entrevistadorId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    entrevistaModalidad: {
      type: DataTypes.STRING(15),
      allowNull: true,
    },
    entrevistaLugar: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    entrevistaEnlace: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    entrevistaObservaciones: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    entrevistaReprogramaciones: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    descartada: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    descartadaAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    formulario: {
      type: DataTypes.JSONB,
      allowNull: false,
    },
  },
  {
    tableName: "postulaciones",
    timestamps: true,
  }
);

module.exports = Postulacion;
