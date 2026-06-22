const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const Usuario = require("./Usuario");

const SistemaTarea = sequelize.define(
  "SistemaTarea",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    titulo: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    descripcion: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    fechaInicio: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    estado: {
      type: DataTypes.ENUM("pendiente", "en_progreso", "finalizado"),
      allowNull: false,
      defaultValue: "pendiente",
    },
    tiempoAcumuladoSegundos: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    cronometroActivo: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    ultimoInicioCronometro: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    finalizadoEn: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    creadoPorId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: Usuario,
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
  },
  {
    tableName: "sistemas_tareas",
    timestamps: true,
    indexes: [
      { fields: ["estado"] },
      { fields: ["fechaInicio"] },
      { fields: ["cronometroActivo"] },
    ],
  },
);

module.exports = SistemaTarea;
