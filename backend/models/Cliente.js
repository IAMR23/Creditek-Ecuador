const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const Cliente = sequelize.define(
  "Cliente",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    cliente: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    cedula: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    telefono: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    timestamps: true,
    tableName: "clientes",
  }
);


module.exports = Cliente;
