const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const CostoHistorico = sequelize.define(
  "costo_historico", 
  {
    precioCarga: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    precioContado: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    costo: { type: DataTypes.FLOAT, allowNull: false },
    margen: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    margenPorcentual: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
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
