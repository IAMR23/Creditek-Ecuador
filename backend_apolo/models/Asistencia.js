const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const ESTADOS_VALIDOS = [
  "asistencia",
  "falta_justificada",
  "falta_injustificada",
  "atraso",
  "salida",
  "pago",
  "capacitacion",
];

const Asistencia = sequelize.define(
  "Asistencia",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    usuarioAgenciaId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "usuario_agencia", key: "id" },
      onDelete: "CASCADE",
    },
    fecha: { type: DataTypes.DATEONLY, allowNull: false },
    estado: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isValidEstado(value) {
          if (value == null) return;
          if (!ESTADOS_VALIDOS.includes(value)) {
            throw new Error("Estado de asistencia inválido.");
          }
        },
      },
    },
    observacion: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    timestamps: true,
    tableName: "asistencias",
    indexes: [{ unique: true, fields: ["usuarioAgenciaId", "fecha"] }],
  }
);

module.exports = Asistencia;
