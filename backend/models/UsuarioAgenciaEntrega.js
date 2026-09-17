const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const UsuarioAgenciaEntrega = sequelize.define(
  "UsuarioAgenciaEntrega",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    usuario_agencia_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    entrega_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    estado: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "Asignada",
    },

    fecha_asignacion: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },

    fecha_finalizacion: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    // Momento en que esta asignacion dejo de ser la vigente por un cambio
    // de responsable. fecha_finalizacion se reserva para el cierre operativo.
    fecha_desasignacion: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    activo: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    timestamps: true,
    tableName: "usuario_agencia_entrega",
    indexes: [
      { fields: ["usuario_agencia_id", "entrega_id"] },
      {
        name: "usuario_agencia_entrega_una_activa_por_entrega",
        unique: true,
        fields: ["entrega_id"],
        where: { activo: true },
      },
    ],
  }
);

module.exports = UsuarioAgenciaEntrega;
