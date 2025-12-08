const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const VentaObsequio = sequelize.define(
  "VentaObsequio",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    obsequioId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    cantidad: {
      type: DataTypes.INTEGER, 
      defaultValue: 1,
    },
    ventaId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  }, 
  {
    timestamps: true,
    tableName: "venta_obsequios",
  }
);

module.exports = VentaObsequio;
