const { DataTypes } = require("sequelize");
const { sequelize } = require("../../config/db");
const { all } = require("axios");

const MovimientoCajaTemp = sequelize.define(
  "MovimientoCajaTemp",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    usuarioAgenciaId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    responsable: DataTypes.STRING,
    detalle: DataTypes.STRING,
    valor: DataTypes.DECIMAL(10, 2),
    formaPago: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    recibo: DataTypes.STRING,
    observacion: DataTypes.STRING,
    estado: DataTypes.STRING,
  },
  {
    tableName: "movimiento_caja_temp", // 👈 CLAVE
    freezeTableName: true, // 👈 EVITA pluralización
  },
);

module.exports = MovimientoCajaTemp;
