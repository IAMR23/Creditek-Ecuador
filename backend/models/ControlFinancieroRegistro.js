const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const TIPOS_REGISTRO = ["CAJA", "VENTA_TV", "VENTA_CELULAR"];
const ESTADOS_PAGO_ENTRADA = ["PENDIENTE", "PAGADO"];

const ControlFinancieroRegistro = sequelize.define(
  "ControlFinancieroRegistro",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    cargaId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "control_financiero_cargas",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    tipoRegistro: {
      type: DataTypes.STRING(30),
      allowNull: false,
      validate: {
        isIn: [TIPOS_REGISTRO],
      },
    },
    contrato: {
      type: DataTypes.STRING(80),
      allowNull: true,
    },
    fecha: {
      type: DataTypes.STRING(80),
      allowNull: true,
    },
    vendedor: {
      type: DataTypes.STRING(160),
      allowNull: true,
    },
    usuarioCobrador: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
    cliente: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    modelo: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    imei: {
      type: DataTypes.STRING(80),
      allowNull: true,
    },
    pagosCuotas: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
      defaultValue: 0,
    },
    numeroCuotas: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    ventas: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
      defaultValue: 0,
    },
    entradas: {
      type: DataTypes.DECIMAL(14, 2),
      allowNull: false,
      defaultValue: 0,
    },
    estadoPagoEntrada: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "PENDIENTE",
      validate: {
        isIn: [ESTADOS_PAGO_ENTRADA],
      },
    },
    responsablePagoEntradaId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "usuarios",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
    },
    observacionPagoEntrada: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    producto: {
      type: DataTypes.STRING(40),
      allowNull: true,
    },
    agencia: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
    archivoOrigen: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    archivoHash: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
  },
  {
    tableName: "control_financiero_registros",
    timestamps: true,
    indexes: [
      {
        name: "control_financiero_registros_carga_tipo_idx",
        fields: ["cargaId", "tipoRegistro"],
      },
      {
        name: "control_financiero_registros_contrato_idx",
        fields: ["contrato"],
      },
      {
        name: "control_financiero_registros_carga_archivo_hash_idx",
        fields: ["cargaId", "archivoHash"],
      },
      {
        name: "control_financiero_registros_estado_pago_entrada_idx",
        fields: ["estadoPagoEntrada"],
      },
      {
        name: "control_financiero_registros_responsable_pago_entrada_idx",
        fields: ["responsablePagoEntradaId"],
      },
    ],
    hooks: {
      beforeDestroy() {
        throw new Error("Los registros financieros no se pueden eliminar.");
      },
      beforeBulkDestroy() {
        throw new Error("Los registros financieros no se pueden eliminar.");
      },
    },
  },
);

ControlFinancieroRegistro.TIPOS_REGISTRO = TIPOS_REGISTRO;
ControlFinancieroRegistro.ESTADOS_PAGO_ENTRADA = ESTADOS_PAGO_ENTRADA;

module.exports = ControlFinancieroRegistro;
