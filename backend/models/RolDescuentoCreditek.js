const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

module.exports = sequelize.define("RolDescuentoCreditek", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  usuarioId: {
    type: DataTypes.INTEGER, allowNull: false,
    references: { model: "usuarios", key: "id" }, onDelete: "RESTRICT", onUpdate: "CASCADE",
  },
  motivo: { type: DataTypes.STRING(200), allowNull: false },
  cuotas: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
  activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  registradoPorId: {
    type: DataTypes.INTEGER, allowNull: false,
    references: { model: "usuarios", key: "id" }, onDelete: "RESTRICT", onUpdate: "CASCADE",
  },
  actualizadoPorId: {
    type: DataTypes.INTEGER, allowNull: false,
    references: { model: "usuarios", key: "id" }, onDelete: "RESTRICT", onUpdate: "CASCADE",
  },
}, {
  tableName: "roles_descuentos_creditek",
  timestamps: true,
  indexes: [{ name: "roles_descuentos_creditek_usuario_idx", fields: ["usuarioId"] }],
});
