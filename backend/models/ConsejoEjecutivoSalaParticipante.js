const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const ConsejoEjecutivoSala = require("./ConsejoEjecutivoSala");
const Usuario = require("./Usuario");

const ConsejoEjecutivoSalaParticipante = sequelize.define(
  "ConsejoEjecutivoSalaParticipante",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    salaId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: ConsejoEjecutivoSala,
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
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
    invitadoPorId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: Usuario,
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
    activo: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    tableName: "consejo_ejecutivo_sala_participantes",
    timestamps: true,
    indexes: [
      { unique: true, fields: ["salaId", "usuarioId"] },
      { fields: ["usuarioId", "activo"] },
    ],
  },
);

module.exports = ConsejoEjecutivoSalaParticipante;
