const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const Agencia = sequelize.define(
  "Agencia",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    nombre: { type: DataTypes.STRING, allowNull: false },
    direccion: { type: DataTypes.STRING, allowNull: true },
    telefono: { type: DataTypes.STRING, allowNull: true },
    ciudad: { type: DataTypes.STRING, allowNull: true },
    tipo: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "AGENCIA",
      validate: { isIn: [["AGENCIA", "DEPARTAMENTO"]] },
    },
    activo: { type: DataTypes.BOOLEAN, defaultValue: true },
  },
  { timestamps: true, tableName: "agencias" }
);

module.exports = Agencia;
