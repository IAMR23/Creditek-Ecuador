const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const SECCIONES = [
  "PRESTAMOS",
  "ANTICIPOS",
];

const TIPOS_EGRESO = [
  "ENTRADAS",
  "CAJAS",
  "TRANSFERENCIAS",
  "DESCUENTOS",
  "JEFES",
  "MULTAS_FACTURACION",
  "OTROS",
];

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
    fecha: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    fechaFin: { type: DataTypes.DATEONLY, allowNull: true },
    seccion: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: "ANTICIPOS",
      validate: { isIn: [SECCIONES] },
    },
    tipo: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: "ENTRADAS",
      validate: { notEmpty: true, len: [1, 30] },
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
      {
        name: "egresos_creditek_entradas_fecha_idx",
        fields: ["fecha"],
      },
      {
        name: "egresos_creditek_entradas_tipo_idx",
        fields: ["tipo"],
      },
    ],
  },
);

EgresoCreditekEntrada.SECCIONES = SECCIONES;
EgresoCreditekEntrada.TIPOS_EGRESO = TIPOS_EGRESO;

module.exports = EgresoCreditekEntrada;
