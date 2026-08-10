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

    correo: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    direccion: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    clienteContifico: { type: DataTypes.STRING, allowNull: true },
    rolId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "roles",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
  },
  {
    timestamps: true,
    tableName: "clientes",
  },
);

module.exports = Cliente;
