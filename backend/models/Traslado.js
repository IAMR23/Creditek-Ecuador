const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const Traslado = sequelize.define(
  "Traslado",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    estado: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    usuario_agencia_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    agencia_destino_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    agencia_origen_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    activo: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    timestamps: true,
    tableName: "traslados",
  },
);

module.exports = Traslado;
