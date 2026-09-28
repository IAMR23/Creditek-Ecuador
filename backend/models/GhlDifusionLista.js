const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const GhlDifusionLista = sequelize.define("GhlDifusionLista", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nombre: { type: DataTypes.STRING(120), allowNull: false },
  filtros: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  creadoPorId: { type: DataTypes.INTEGER, allowNull: false },
  actualizadoPorId: { type: DataTypes.INTEGER, allowNull: false },
}, {
  tableName: "ghl_difusion_listas",
  timestamps: true,
  indexes: [{ fields: ["updatedAt"] }],
});

module.exports = GhlDifusionLista;
