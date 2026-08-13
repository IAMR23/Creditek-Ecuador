const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const Usuario = require("./Usuario");
const ConsejoEjecutivoSala = require("./ConsejoEjecutivoSala");

const ConsejoEjecutivoPlan = sequelize.define(
  "ConsejoEjecutivoPlan",
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
    salaId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: ConsejoEjecutivoSala,
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },
    condicion: {
      type: DataTypes.STRING(40),
      allowNull: false,
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
    observaciones: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    revision: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
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
    actualizadoPorId: {
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
    tableName: "consejo_ejecutivo_planes",
    timestamps: true,
    indexes: [
      { fields: ["salaId"] },
      { fields: ["fecha"] },
      { fields: ["condicion"] },
      { fields: ["updatedAt"] },
    ],
  },
);

module.exports = ConsejoEjecutivoPlan;
