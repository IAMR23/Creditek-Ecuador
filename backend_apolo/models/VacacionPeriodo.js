const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const VacacionPeriodo = sequelize.define("VacacionPeriodo", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  usuarioId: { type: DataTypes.INTEGER, allowNull: false, references: { model: "usuarios", key: "id" } },
  fechaInicio: { type: DataTypes.DATEONLY, allowNull: false },
  fechaFin: { type: DataTypes.DATEONLY, allowNull: false },
  estado: { type: DataTypes.STRING(20), allowNull: false, validate: { isIn: [["CUMPLIDO", "FORMACION"]] } },
  fechaCorte: { type: DataTypes.DATEONLY, allowNull: false },
  observacion: { type: DataTypes.TEXT, allowNull: true },
  creadoPorId: { type: DataTypes.INTEGER, allowNull: false, references: { model: "usuarios", key: "id" } },
}, {
  tableName: "vacacion_periodos",
  timestamps: true,
  indexes: [{ unique: true, fields: ["usuarioId", "fechaInicio", "fechaFin"] }],
});

module.exports = VacacionPeriodo;
