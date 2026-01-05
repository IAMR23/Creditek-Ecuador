const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const Postulacion = sequelize.define(
  "Postulacion",
  {
    id: {
      type: DataTypes.INTEGER, 
      autoIncrement: true,
      primaryKey: true,
    },

    nombre: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    cedula: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    telefono: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    formulario: {
      type: DataTypes.JSONB, // 🔥 JSON completo
      allowNull: false,
    },
  },
  {
    tableName: "postulaciones",
    timestamps: true, // createdAt / updatedAt
  }
);

module.exports = Postulacion;
