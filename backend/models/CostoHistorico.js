const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const DispositivoMarca = require("./DispositivoMarca");

const CostoHistorico = sequelize.define(
  "costo_historico", 
  {
    precio: { type: DataTypes.FLOAT, allowNull: false },
    fechaCompra: { type: DataTypes.DATE, allowNull: false },
    proveedor: { type: DataTypes.STRING, allowNull: true },
    nota: { type: DataTypes.STRING, allowNull: true },
    modeloId: { type: DataTypes.INTEGER, allowNull: false },
    formaPagoId: { type: DataTypes.INTEGER, allowNull: true },  
  },
  {
    timestamps: true,
    tableName: "costo_historicos",
  }
); 

module.exports = CostoHistorico;
