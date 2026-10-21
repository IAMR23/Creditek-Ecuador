const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const GhlDifusionCategoria = sequelize.define("GhlDifusionCategoria", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nombre: { type: DataTypes.STRING(80), allowNull: false },
  creadoPorId: { type: DataTypes.INTEGER, allowNull: false },
  actualizadoPorId: { type: DataTypes.INTEGER, allowNull: false },
}, {
  tableName: "ghl_difusion_categorias",
  timestamps: true,
  indexes: [{ fields: ["updatedAt"] }],
});

module.exports = GhlDifusionCategoria;
