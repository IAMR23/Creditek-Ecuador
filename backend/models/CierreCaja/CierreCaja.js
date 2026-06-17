// models/CierreCaja/CierreCaja.js
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

    fecha: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },

    usuarioAgenciaId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    agenciaId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    usuarioId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    usuarioCreacion: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    usuarioModificacion: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    fechaCreacion: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    fechaModificacion: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    observacion: {
      type: DataTypes.STRING, 
      allowNull: true,
    },

    observacionContabilidad: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    totalFisico: { 
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },

    totalEfectivo: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },

    totalTransferencia: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },

    totalPendiente: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },

    totalSistema: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },

    diferencia: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },

    estado: {
      type: DataTypes.ENUM("CUADRADO", "DESCUADRADO"),
      allowNull: false,
      defaultValue: "CUADRADO",
    }, 

    estadoCierre: {
      type: DataTypes.ENUM("CERRADO", "REABIERTO", "ANULADO"),
      allowNull: false,
      defaultValue: "CERRADO",
    },

    reabiertoPorUsuarioId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    fechaReapertura: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    motivoReapertura: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    recerradoPorUsuarioId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    fechaRecierre: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "cierre_caja",
    timestamps: true,
  },
);

module.exports = CierreCaja;
