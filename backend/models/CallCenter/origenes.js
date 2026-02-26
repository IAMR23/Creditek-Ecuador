const { DataTypes } = require("sequelize");
const { sequelize } = require("../../config/db");

const OrigenCallCenter = sequelize.define(
  "OrigenCallCenter",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

    nombre: { type: DataTypes.STRING, allowNull: false },
    activa: { type: DataTypes.BOOLEAN, defaultValue: true },
  },
  {
    timestamps: true,
    tableName: "origenCallCenter",
  },
);

module.exports = OrigenCallCenter;
