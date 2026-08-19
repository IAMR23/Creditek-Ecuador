const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const FacturaIaResultado = sequelize.define(
  "FacturaIaResultado",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    grupoComparacion: {
      type: DataTypes.STRING(160),
      allowNull: false,
    },
    nombreArchivoJson: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    sha256: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    proveedor: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    rucProveedor: {
      type: DataTypes.STRING(30),
      allowNull: true,
    },
    numeroFactura: {
      type: DataTypes.STRING(80),
      allowNull: true,
    },
    fechaEmision: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    subtotal: {
      type: DataTypes.DECIMAL(18, 6),
      allowNull: true,
    },
    impuestos: {
      type: DataTypes.DECIMAL(18, 6),
      allowNull: true,
    },
    total: {
      type: DataTypes.DECIMAL(18, 6),
      allowNull: true,
    },
    totalProductosCalculado: {
      type: DataTypes.DECIMAL(18, 6),
      allowNull: true,
    },
    diferenciaProductosSubtotal: {
      type: DataTypes.DECIMAL(18, 6),
      allowNull: true,
    },
    diferenciaSubtotalImpuestosTotal: {
      type: DataTypes.DECIMAL(18, 6),
      allowNull: true,
    },
    cantidadProductos: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    puntaje: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0,
    },
    esSeleccionada: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    payloadOriginal: {
      type: DataTypes.JSONB,
      allowNull: false,
    },
    payloadNormalizado: {
      type: DataTypes.JSONB,
      allowNull: false,
    },
    advertencias: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    creadoPorId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: "usuarios", key: "id" },
    },
    seleccionadoPorId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: "usuarios", key: "id" },
    },
    seleccionadoEn: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "facturas_ia_resultados",
    timestamps: true,
    indexes: [
      { name: "facturas_ia_grupo_idx", fields: ["grupoComparacion"] },
      { name: "facturas_ia_seleccion_idx", fields: ["esSeleccionada"] },
      { name: "facturas_ia_creacion_idx", fields: ["createdAt"] },
      { name: "facturas_ia_ruc_numero_idx", fields: ["rucProveedor", "numeroFactura"] },
      { name: "facturas_ia_puntaje_idx", fields: ["puntaje"] },
    ],
  },
);

module.exports = FacturaIaResultado;
