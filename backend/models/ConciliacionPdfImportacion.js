const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const ConciliacionLote = require("./ConciliacionLote");

const ConciliacionPdfImportacion = sequelize.define(
  "ConciliacionPdfImportacion",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    tipoProducto: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    origen: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    archivoOrigen: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    factura: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    fecha: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    cliente: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    codigoPdf: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    modeloNormalizado: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    imei: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    cantidad: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    precio: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    estado: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "PENDIENTE_REVISION",
    },
    observacion: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    loteImportacionId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: ConciliacionLote,
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
  },
  {
    timestamps: true,
    tableName: "conciliacion_pdf_importaciones",
  },
);

module.exports = ConciliacionPdfImportacion;
