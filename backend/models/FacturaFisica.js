const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const ESTADOS_FACTURA_FISICA = [
  "CARGADA",
  "PENDIENTE_REVISION",
  "REVISADA",
  "CONFIRMADA",
  "ANULADA",
  "ERROR",
];

const FacturaFisica = sequelize.define(
  "FacturaFisica",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    nombreArchivoOriginal: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    nombreArchivoGuardado: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    mimeType: {
      type: DataTypes.STRING(120),
      allowNull: false,
    },
    extension: {
      type: DataTypes.STRING(12),
      allowNull: false,
    },
    sizeBytes: {
      type: DataTypes.BIGINT,
      allowNull: false,
    },
    sha256: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    rutaArchivo: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    estado: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: "CARGADA",
      validate: {
        isIn: [ESTADOS_FACTURA_FISICA],
      },
    },
    origenCarga: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: "WEB",
    },
    usuarioCargaId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "usuarios",
        key: "id",
      },
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
      type: DataTypes.DECIMAL(14, 2),
      allowNull: true,
    },
    impuestos: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: true,
    },
    total: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: true,
    },
    observacion: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    datosAdicionales: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    motivoAnulacion: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    anuladoPorId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "usuarios",
        key: "id",
      },
    },
    anuladoEn: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    creadoPorId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "usuarios",
        key: "id",
      },
    },
    actualizadoPorId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "usuarios",
        key: "id",
      },
    },
  },
  {
    tableName: "facturas_fisicas",
    timestamps: true,
    indexes: [
      { name: "facturas_fisicas_sha256_idx", fields: ["sha256"] },
      { name: "facturas_fisicas_estado_idx", fields: ["estado"] },
      { name: "facturas_fisicas_created_at_idx", fields: ["createdAt"] },
      {
        name: "facturas_fisicas_usuario_carga_idx",
        fields: ["usuarioCargaId"],
      },
      { name: "facturas_fisicas_ruc_proveedor_idx", fields: ["rucProveedor"] },
      { name: "facturas_fisicas_numero_factura_idx", fields: ["numeroFactura"] },
    ],
  },
);

FacturaFisica.ESTADOS = ESTADOS_FACTURA_FISICA;

module.exports = FacturaFisica;
