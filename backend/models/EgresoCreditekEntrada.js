const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const SECCIONES = ["ENTRADAS", "CAJAS", "TRANSFERENCIAS", "DESCUENTOS"];

const EgresoCreditekEntrada = sequelize.define(
  "EgresoCreditekEntrada",
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
    valor: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      validate: { min: 0.01 },
    },
    observacion: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    seccion: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: "ENTRADAS",
      validate: { isIn: [SECCIONES] },
    },
    activo: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    ultimaAccion: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "CREADO",
      validate: {
        isIn: [["CREADO", "EDITADO", "DESACTIVADO", "REACTIVADO"]],
      },
    },
    registradoPorId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "usuarios", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
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
    tableName: "egresos_creditek_entradas",
    timestamps: true,
    indexes: [
      {
        name: "egresos_creditek_entradas_usuario_idx",
        fields: ["usuarioId"],
      },
      {
        name: "egresos_creditek_entradas_created_at_idx",
        fields: ["createdAt"],
      },
    ],
  },
);

EgresoCreditekEntrada.SECCIONES = SECCIONES;

module.exports = EgresoCreditekEntrada;
