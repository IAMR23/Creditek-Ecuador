const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const Dispositivo = sequelize.define(
  "Dispositivo",
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
    tableName: "dispositivos",
  }
);

module.exports = Dispositivo;
  