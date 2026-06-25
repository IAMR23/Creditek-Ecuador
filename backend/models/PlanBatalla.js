const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const UsuarioAgencia = require("./UsuarioAgencia");

const PlanBatalla = sequelize.define(
  "PlanBatalla",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    usuarioAgenciaId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: UsuarioAgencia,
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },
    condicion: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    fechaInicio: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    fechaFin: {
      type: DataTypes.DATEONLY,
      allowNull: true,
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
    observacion: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "planes_batalla",
    timestamps: true,
    indexes: [
      { fields: ["usuarioAgenciaId"] },
      { fields: ["condicion"] },
      { fields: ["fechaInicio"] },
      { fields: ["fechaFin"] },
    ],
  },
);

module.exports = PlanBatalla;
