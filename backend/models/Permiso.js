const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const Permiso = sequelize.define(
  "Permiso",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    nombre: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    descripcion: {
      type: DataTypes.STRING(255),
    }, 
  },
  {
    timestamps: false,
    tableName: "permisos",
  } 
);

module.exports = Permiso;
