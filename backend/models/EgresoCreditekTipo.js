const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

module.exports = sequelize.define("EgresoCreditekTipo", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  seccion: { type: DataTypes.STRING(30), allowNull: false, validate: { isIn: [["PRESTAMOS", "ANTICIPOS"]] } },
  codigo: { type: DataTypes.STRING(30), allowNull: false },
  nombre: { type: DataTypes.STRING(100), allowNull: false },
  nombreClave: { type: DataTypes.STRING(100), allowNull: false },
  activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  actualizadoPorId: { type: DataTypes.INTEGER, allowNull: true, references: { model: "usuarios", key: "id" }, onDelete: "SET NULL", onUpdate: "CASCADE" },
}, {
  tableName: "egresos_creditek_tipos", timestamps: true,
  indexes: [
    { name: "egresos_creditek_tipos_codigo_unique", unique: true, fields: ["seccion", "codigo"] },
    { name: "egresos_creditek_tipos_nombre_unique", unique: true, fields: ["seccion", "nombreClave"] },
  ],
});
