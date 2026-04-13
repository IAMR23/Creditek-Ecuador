const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const GestionComercial = sequelize.define(
  "GestionComercial",
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

    celularGestionado: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    cedulaGestionado: {
      type: DataTypes.STRING,
      allowNull: true,
    },


    dispositivoId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    solicitud: {
      type: DataTypes.ENUM("NINGUNA", "APROBADO", "DENEGADO"),
      allowNull: false,
    },
    origen: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    observacion: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    timestamps: true,
    tableName: "gestionesComerciales",
  },
);

module.exports = GestionComercial;
