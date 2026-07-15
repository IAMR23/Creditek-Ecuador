// models/DetalleEntrega.js
const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const DispositivoMarca = require("./DispositivoMarca"); // Cambiado a DispositivoMarca
const Modelo = require("./Modelo");
const {
  esUbicacionClienteValida,
  MENSAJE_UBICACION_CLIENTE_INVALIDA,
} = require("../utils/validarUbicacionCliente");

const DetalleEntrega = sequelize.define(
  "DetalleEntrega",
  {
    id: { 
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    cantidad: {
      type: DataTypes.INTEGER,
      allowNull: false,  
      validate: { min: 1 },
    },
    precioUnitario: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,  
    },
    precioVendedor: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    dispositivoMarcaId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: DispositivoMarca, key: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },

    modeloId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: Modelo, key: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },
    contrato: {
      type: DataTypes.STRING,
    },
    identificadorAnuncio: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    formaPagoId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    entrada: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    alcance: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    ubicacion: {
      type: DataTypes.TEXT,
      validate: {
        contieneTexto(valor) {
          if (!esUbicacionClienteValida(valor)) {
            throw new Error(MENSAJE_UBICACION_CLIENTE_INVALIDA);
          }
        },
      },
    },
    ubicacionDispositivo: {
      type: DataTypes.TEXT,
    },
    observacionDetalle: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    tableName: "detalle_entregas",
    timestamps: true,
  }
);

module.exports = DetalleEntrega;
