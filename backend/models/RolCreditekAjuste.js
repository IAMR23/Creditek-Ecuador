const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const RolCreditekAjuste = sequelize.define(
  "RolCreditekAjuste",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    usuarioId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "usuarios", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },
    anio: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { min: 2000, max: 2100 },
    },
    mes: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { min: 1, max: 12 },
    },
    adelantosTransfer: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      validate: { min: 0 },
    },
    deudaJimena: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      validate: { min: 0 },
    },
    atrasos: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      validate: { min: 0 },
    },
    diasNoLaborables: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      validate: { min: 0 },
    },
    multasFacturacion: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      validate: { min: 0 },
    },
    planmovi: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      validate: { min: 0 },
    },
    prestamo: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      validate: { min: 0 },
    },
    mecanica: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      validate: { min: 0 },
    },
    pagosLentes: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      validate: { min: 0 },
    },
    sueldo: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      validate: { min: 0 },
    },
    descuentosMetaManual: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      validate: { min: 0 },
    },
    cajaGeneralManual: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      validate: { min: 0 },
    },
    entradasManual: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      validate: { min: 0 },
    },
    descuentosManual: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      validate: { min: 0 },
    },
    actualizadoPorId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "usuarios", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
  },
  {
    tableName: "roles_creditek_ajustes",
    timestamps: true,
    indexes: [
      {
        name: "roles_creditek_ajustes_usuario_periodo_unique",
        unique: true,
        fields: ["usuarioId", "anio", "mes"],
      },
      {
        name: "roles_creditek_ajustes_periodo_idx",
        fields: ["anio", "mes"],
      },
    ],
  },
);

module.exports = RolCreditekAjuste;
