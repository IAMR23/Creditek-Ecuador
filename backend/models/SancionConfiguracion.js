const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const SancionConfiguracion = sequelize.define("SancionConfiguracion", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  rolPagoId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: "roles_pago", key: "id" },
    onUpdate: "CASCADE",
    onDelete: "SET NULL",
  },
  cargoReferencia: { type: DataTypes.STRING, allowNull: false },
  periodo: {
    type: DataTypes.ENUM("SEMANAL", "MENSUAL", "RANGO"),
    allowNull: false,
  },
  minimoUnidades: { type: DataTypes.INTEGER, allowNull: false },
  valorMultaUnidad: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  descripcion: { type: DataTypes.TEXT, allowNull: true },
  activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, {
  tableName: "sanciones_configuracion",
  timestamps: true,
  indexes: [
    { unique: true, fields: ["cargoReferencia", "periodo"] },
    { fields: ["rolPagoId"] },
    { fields: ["activo"] },
  ],
});

module.exports = SancionConfiguracion;
