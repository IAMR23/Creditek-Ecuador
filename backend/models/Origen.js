const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const Origen = sequelize.define(
  "Origen",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    nombre: {
      type: DataTypes.STRING,
      allowNull: false,
      comment: "Nombre del origen, por ejemplo tienda, proveedor, online, etc.",
    },
    descripcion: {
      type: DataTypes.TEXT, 
      allowNull: true,
    },
    activo: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    tableName: "origenes",
    timestamps: true, // createdAt y updatedAt
  }
);

module.exports = Origen;
