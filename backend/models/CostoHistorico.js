const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const CostoHistorico = sequelize.define(
  "costo_historico", 
  {
    costo: { type: DataTypes.FLOAT, allowNull: false },
    fechaCompra: { type: DataTypes.DATEONLY, allowNull: false },  
    nota: { type: DataTypes.STRING, allowNull: true },
    modeloId: { type: DataTypes.INTEGER, allowNull: false },
  },
  {
    timestamps: true,
    tableName: "costo_historicos",
  } 
); 

module.exports = CostoHistorico;
