const { DataTypes } = require("sequelize");
const { sequelize } = require("../../config/db");

const Extensiones = sequelize.define(
  "Extensiones",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

    nombre: { type: DataTypes.STRING, allowNull: false },
    activa: { type: DataTypes.BOOLEAN, defaultValue: true },

    fecha: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
  },
  {
    timestamps: true,
    tableName: "extensiones",
  },
);

module.exports = Extensiones;
