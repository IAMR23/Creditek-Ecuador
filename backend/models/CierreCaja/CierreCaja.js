const { DataTypes } = require("sequelize");
const { sequelize } = require("../../config/db");

const CierreCaja = sequelize.define(
  "CierreCaja",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    agenciaId: {
  type: DataTypes.INTEGER,
  allowNull: false,
},


    fecha: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },

    totalEfectivoSistema: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },

    totalTransferenciaSistema: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },

    totalGeneralSistema: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },

    totalEfectivoFisico: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },

    diferencia: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },

    observacion: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    usuarioCreacion: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    timestamps: true,
    tableName: "cierre_caja",
  }
);

module.exports = CierreCaja;
