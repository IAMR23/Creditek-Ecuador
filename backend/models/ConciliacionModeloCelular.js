const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const Modelo = require("./Modelo");

const ConciliacionModeloCelular = sequelize.define(
  "ConciliacionModeloCelular",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    origen: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "PDF_UPHONE",
    },
    codigoPdf: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    codigoNormalizado: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    modeloRveId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: Modelo,
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
    modeloRveNombre: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    estado: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "PENDIENTE",
    },
    vecesDetectado: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    archivosOrigen: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    observacion: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    timestamps: true,
    tableName: "conciliacion_modelos_celular",
    indexes: [
      {
        unique: true,
        fields: ["codigoNormalizado"],
      },
    ],
  },
);

module.exports = ConciliacionModeloCelular;
