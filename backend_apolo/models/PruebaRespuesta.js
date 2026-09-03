const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const PruebaRespuesta = sequelize.define(
  "PruebaRespuesta",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    intentoId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "prueba_intentos", key: "id" },
      onDelete: "CASCADE",
    },
    preguntaId: { type: DataTypes.STRING(20), allowNull: false },
    tipo: {
      type: DataTypes.STRING(24),
      allowNull: false,
      validate: { isIn: [["opcion_multiple", "abierta"]] },
    },
    pregunta: { type: DataTypes.TEXT, allowNull: false },
    opciones: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    opcionSeleccionada: { type: DataTypes.STRING(5), allowNull: true },
    textoRespuesta: { type: DataTypes.TEXT, allowNull: true },
    respuestaCorrecta: { type: DataTypes.STRING(5), allowNull: true },
    correcta: { type: DataTypes.BOOLEAN, allowNull: true },
    puntajeAutomatico: { type: DataTypes.DECIMAL(8, 4), allowNull: true },
    puntajeSupervisor: { type: DataTypes.DECIMAL(3, 1), allowNull: true },
    observacionSupervisor: { type: DataTypes.TEXT, allowNull: true },
  },
  {
    timestamps: true,
    tableName: "prueba_respuestas",
    indexes: [{ unique: true, fields: ["intentoId", "preguntaId"] }],
  },
);

module.exports = PruebaRespuesta;
