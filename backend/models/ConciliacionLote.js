const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const ConciliacionLote = sequelize.define(
  "ConciliacionLote",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    tipoProducto: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    totalRegistros: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    totalValidos: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    totalErrores: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    estado: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "IMPORTADO",
    },
    usuarioId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "usuarios",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
  },
  {
    timestamps: true,
    tableName: "conciliacion_lotes",
  },
);

module.exports = ConciliacionLote;
