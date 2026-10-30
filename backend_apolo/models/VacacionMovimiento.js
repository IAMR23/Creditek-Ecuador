const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const VacacionMovimiento = sequelize.define("VacacionMovimiento", {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  periodoId: { type: DataTypes.INTEGER, allowNull: false, references: { model: "vacacion_periodos", key: "id" } },
  categoria: {
    type: DataTypes.STRING(30), allowNull: false,
    validate: { isIn: [["RECONOCIDO_ORDINARIO", "RECONOCIDO_ADICIONAL", "DISFRUTADO", "COMPROMETIDO", "RESERVADO_COMPENSACION", "COMPENSADO"]] },
  },
  dias: { type: DataTypes.DECIMAL(8, 2), allowNull: false },
  motivo: { type: DataTypes.TEXT, allowNull: false },
  fechaEfectiva: { type: DataTypes.DATEONLY, allowNull: false },
  origenTipo: { type: DataTypes.STRING(30), allowNull: false },
  origenId: { type: DataTypes.STRING(80), allowNull: false },
  creadoPorId: { type: DataTypes.INTEGER, allowNull: false, references: { model: "usuarios", key: "id" } },
}, {
  tableName: "vacacion_movimientos",
  timestamps: true,
  updatedAt: false,
  indexes: [
    { fields: ["periodoId", "categoria"] },
    { unique: true, fields: ["periodoId", "categoria", "origenTipo", "origenId"] },
  ],
});

module.exports = VacacionMovimiento;
