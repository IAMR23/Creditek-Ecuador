const { DataTypes } = require("sequelize");
const { sequelize } = require("../../config/db");

const MovimientoCaja = sequelize.define(
  "MovimientoCaja",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    responsable: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    detalle: {
      /*       type: DataTypes.ENUM(
        "CUOTA",
        "ENTRADA",
        "ALCANCE",
        "CONTADO",
        "CANCELA ENTRA. PENDIENTE",
        "CANCELA ALCANCE PENDIENTE",
        "EGRESO",
      ), */
      type: DataTypes.STRING,
      allowNull: true,
    },

    valor: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },

    fecha: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    entidad: {
      // type: DataTypes.ENUM("UPHONE", "CREDITV", "CONTADO"),
      type: DataTypes.STRING,
      allowNull: true,
    },  

    formaPago: {
      //    type: DataTypes.ENUM("EFECTIVO", "TRANSFERENCIA", "PENDIENTE"),
      type: DataTypes.STRING,
      allowNull: false,
    },

    nroRecibo: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    observacion: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    observacionesExtra: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    usuarioCreacion: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    agenciaId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    cierreCajaId: {
      type: DataTypes.INTEGER,
      allowNull: true, // null = aún no cerrado
    },
  },
  {
    timestamps: true,
    tableName: "movimiento_caja",
  },
);

module.exports = MovimientoCaja;
