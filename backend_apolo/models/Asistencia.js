const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

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
      allowNull: false,
      validate: {
        isIn: {
          args: [
            [
              "asistencia",
              "falta_justificada",
              "falta_injustificada",
              "atraso",
              "salida",
            ],
          ],
          msg: "Estado de asistencia inválido.",
        },
      },
    },
  },
  {
    timestamps: true,
    tableName: "asistencias",
    indexes: [{ unique: true, fields: ["usuarioAgenciaId", "fecha"] }],
  }
);

module.exports = Asistencia;

