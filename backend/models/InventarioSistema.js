const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const InventarioSistema = sequelize.define(
  "InventarioSistema",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    nombre: {
      type: DataTypes.STRING(120),
      allowNull: false,
    },
    marca: {
      type: DataTypes.STRING(80),
      allowNull: true,
    },
    modelo: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
    estado: {
      type: DataTypes.STRING(40),
      allowNull: false,
      defaultValue: "OPERATIVO",
    },
    observacion: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    agenciaId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "agencias", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },
    responsableId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "usuarios", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },
    creadoPorId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "usuarios", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
    actualizadoPorId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "usuarios", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
    activo: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    tableName: "sistemas_inventarios",
    timestamps: true,
    indexes: [
      { fields: ["activo", "agenciaId"] },
      { fields: ["responsableId"] },
      { fields: ["estado"] },
    ],
  },
);

module.exports = InventarioSistema;
