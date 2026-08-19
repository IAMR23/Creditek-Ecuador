const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const ESTADOS_PRODUCTO_OCR = ["DETECTADO", "CONFIRMADO", "DESCARTADO"];

const FacturaFisicaProductoOcr = sequelize.define(
  "FacturaFisicaProductoOcr",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    facturaFisicaId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "facturas_fisicas", key: "id" },
    },
    descripcion: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },
    cantidad: {
      type: DataTypes.DECIMAL(14, 3),
      allowNull: true,
    },
    precioUnitario: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: true,
    },
    descuento: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: true,
    },
    totalLinea: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: true,
    },
    codigo: {
      type: DataTypes.STRING(80),
      allowNull: true,
    },
    advertencias: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    orden: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    estado: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "DETECTADO",
      validate: { isIn: [ESTADOS_PRODUCTO_OCR] },
    },
    loteOcr: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    versionOcr: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    esResultadoActual: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    editadoManualmente: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    detectadoPorId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "usuarios", key: "id" },
    },
    actualizadoPorId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "usuarios", key: "id" },
    },
    confirmadoPorId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "usuarios", key: "id" },
    },
    confirmadoEn: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    descartadoPorId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "usuarios", key: "id" },
    },
    descartadoEn: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "facturas_fisicas_productos_ocr",
    timestamps: true,
    indexes: [
      {
        name: "facturas_fisicas_productos_ocr_factura_idx",
        fields: ["facturaFisicaId"],
      },
      {
        name: "facturas_fisicas_productos_ocr_estado_idx",
        fields: ["estado"],
      },
      {
        name: "facturas_fisicas_productos_ocr_lote_idx",
        fields: ["loteOcr"],
      },
      {
        name: "facturas_fisicas_productos_ocr_actual_idx",
        fields: ["facturaFisicaId", "esResultadoActual", "orden"],
      },
    ],
  },
);

FacturaFisicaProductoOcr.ESTADOS = ESTADOS_PRODUCTO_OCR;

module.exports = FacturaFisicaProductoOcr;
