const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const FacturaRegistro = sequelize.define(
  "FacturaRegistro",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    fechaFactura: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    proveedor: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    identificacionProveedor: {
      type: DataTypes.STRING(30),
      allowNull: true,
    },
    numeroFactura: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    subtotal: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: true,
    },
    iva: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: true,
    },
    total: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: true,
    },
    formaPago: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
    estado: {
      type: DataTypes.STRING(80),
      allowNull: true,
    },
    enlaceFoto: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    observaciones: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    tipo: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    nombreArchivoJson: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    payloadOriginal: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
  },
  {
    tableName: "facturas",
    timestamps: true,
    indexes: [
      { name: "facturas_fecha_factura_idx", fields: ["fechaFactura"] },
      { name: "facturas_fecha_carga_idx", fields: ["createdAt"] },
      { name: "facturas_proveedor_idx", fields: ["proveedor"] },
      {
        name: "facturas_identificacion_numero_idx",
        fields: ["identificacionProveedor", "numeroFactura"],
      },
      {
        name: "facturas_numero_factura_unique",
        unique: true,
        fields: ["numeroFactura"],
      },
      { name: "facturas_estado_idx", fields: ["estado"] },
      { name: "facturas_tipo_idx", fields: ["tipo"] },
    ],
  },
);

module.exports = FacturaRegistro;
