const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const PruebaIntento = sequelize.define(
  "PruebaIntento",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    usuarioId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "usuarios", key: "id" },
      onDelete: "RESTRICT",
    },
    tipo: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: { isIn: [["piso", "call_center"]] },
    },
    estado: {
      type: DataTypes.STRING(24),
      allowNull: false,
      defaultValue: "EN_PROGRESO",
      validate: {
        isIn: [["EN_PROGRESO", "PENDIENTE_REVISION", "CALIFICADA"]],
      },
    },
    notaAutomatica: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
    notaSupervisor: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
    notaFinal: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
    aprobado: { type: DataTypes.BOOLEAN, allowNull: true },
    supervisorId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "usuarios", key: "id" },
      onDelete: "SET NULL",
    },
    fechaInicio: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    fechaEnvio: { type: DataTypes.DATE, allowNull: true },
    fechaCalificacion: { type: DataTypes.DATE, allowNull: true },
    observacionGeneral: { type: DataTypes.TEXT, allowNull: true },
    preguntasSnapshot: { type: DataTypes.JSONB, allowNull: false },
  },
  {
    timestamps: true,
    tableName: "prueba_intentos",
    indexes: [
      { fields: ["usuarioId", "createdAt"] },
      { fields: ["estado", "fechaEnvio"] },
      {
        name: "prueba_intentos_un_progreso_usuario_uidx",
        unique: true,
        fields: ["usuarioId"],
        where: { estado: "EN_PROGRESO" },
      },
    ],
  },
);

module.exports = PruebaIntento;
