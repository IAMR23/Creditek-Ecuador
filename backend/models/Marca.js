const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const Dispositivo = require("./Dispositivo");

const Marca = sequelize.define(
  "Marca",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    nombre: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    activo: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    timestamps: true,
    tableName: "marcas",
  }
);

module.exports = Marca;
