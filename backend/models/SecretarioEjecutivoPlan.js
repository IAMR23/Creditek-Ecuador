const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const Usuario = require("./Usuario");
const Agencia = require("./Agencia");

const SecretarioEjecutivoPlan = sequelize.define(
  "SecretarioEjecutivoPlan",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    fecha: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    usuarioId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Usuario,
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },
    agenciaId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Agencia,
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },
    objetivoDia: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    actividadesPlanificadas: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    condicion: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "inexistencia",
    },
    respuestasFormula: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    detalle: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    prioridad: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    estado: {
      type: DataTypes.ENUM("PENDIENTE", "EN_PROGRESO", "FINALIZADO"),
      allowNull: false,
      defaultValue: "PENDIENTE",
    },
    observaciones: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "secretarios_ejecutivos_planes",
    timestamps: true,
    indexes: [
      { fields: ["fecha"] },
      { fields: ["usuarioId"] },
      { fields: ["agenciaId"] },
      { fields: ["estado"] },
    ],
  },
);

module.exports = SecretarioEjecutivoPlan;
