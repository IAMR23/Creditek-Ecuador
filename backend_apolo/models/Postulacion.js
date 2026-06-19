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
    leida: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    leidaAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    formulario: {
      type: DataTypes.JSONB,
      allowNull: false,
    },
  },
  {
    tableName: "postulaciones",
    timestamps: true,
  }
);

module.exports = Postulacion;
