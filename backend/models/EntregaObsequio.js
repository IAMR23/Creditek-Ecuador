const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const EntregaObsequio = sequelize.define(
  "EntregaObsequio",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    entregaId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    obsequioId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    cantidad: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
    },
    entregaId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  { 
    timestamps: true,
    tableName: "entrega_obsequios", 
  }
); 

module.exports = EntregaObsequio;
