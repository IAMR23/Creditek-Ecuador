const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const UsuarioAgencia = require("./UsuarioAgencia");

const Venta = sequelize.define(
  "Venta",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    usuarioAgenciaId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    clienteId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    origenId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    activo: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    observacion: {
      type: DataTypes.STRING,
    },
    fecha: {
      type: DataTypes.DATEONLY,
      defaultValue: DataTypes.NOW,
    },
    validada: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },

    fotoValidacion: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    semana : {
      type
        : DataTypes.INTEGER,
      allowNull: true,
    }
  },
  {
    tableName: "ventas",
    timestamps: true,
  }
);

Venta.belongsTo(UsuarioAgencia, {
  foreignKey: "usuarioAgenciaId",
  as: "usuarioAgencia",
});

module.exports = Venta;
