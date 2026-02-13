const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const TrasladoObsequio = sequelize.define(
  "TrasladoObsequio",
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
    trasladoId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  }, 
  {
    timestamps: true,
    tableName: "traslado_obsequios",
  }
);

module.exports = TrasladoObsequio;
