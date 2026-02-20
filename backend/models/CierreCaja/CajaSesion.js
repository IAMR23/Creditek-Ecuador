const { DataTypes } = require("sequelize");
const { sequelize } = require("../../config/db");

const CajaSesion = sequelize.define(
  "CajaSesion",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

    agenciaId: { type: DataTypes.INTEGER, allowNull: false },

    usuarioId: { type: DataTypes.INTEGER, allowNull: false },

    activa: { type: DataTypes.BOOLEAN, defaultValue: true },

    fecha: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
  },
  {
    timestamps: true,
    tableName: "caja_sesiones",
  }
);

module.exports = CajaSesion;
