const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const GhlDifusionMensaje = sequelize.define("GhlDifusionMensaje", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nombre: { type: DataTypes.STRING(120), allowNull: false },
  contenido: { type: DataTypes.TEXT, allowNull: false },
  creadoPorId: { type: DataTypes.INTEGER, allowNull: false },
  actualizadoPorId: { type: DataTypes.INTEGER, allowNull: false },
}, {
  tableName: "ghl_difusion_mensajes",
  timestamps: true,
  indexes: [{ fields: ["updatedAt"] }],
});

module.exports = GhlDifusionMensaje;
