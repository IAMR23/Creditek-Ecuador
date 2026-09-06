const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

module.exports = sequelize.define("PagoComisionSancionObservacion", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  anio: { type: DataTypes.INTEGER, allowNull: false },
  mes: { type: DataTypes.INTEGER, allowNull: false },
  observacion: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" },
  observacionesVendedores: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  actualizadoPorId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: "usuarios", key: "id" },
    onUpdate: "CASCADE",
    onDelete: "SET NULL",
  },
}, {
  tableName: "pagos_comisiones_sanciones_observaciones",
  timestamps: true,
  indexes: [{ unique: true, fields: ["anio", "mes"] }],
});
