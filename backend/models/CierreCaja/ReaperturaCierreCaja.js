const { DataTypes } = require("sequelize");
const { sequelize } = require("../../config/db");

const ReaperturaCierreCaja = sequelize.define(
  "ReaperturaCierreCaja",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    cierreId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    reabiertoPorUsuarioId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    motivo: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    fechaReapertura: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },

    recerradoPorUsuarioId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    fechaRecierre: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    snapshotPrevio: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
  },
  {
    tableName: "reaperturas_cierre_caja",
    timestamps: true,
  },
);

module.exports = ReaperturaCierreCaja;
