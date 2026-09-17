const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const UsuarioAgencia = require("./UsuarioAgencia");

const Entrega = sequelize.define(
  "Entrega",
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
    semana: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    clienteId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    version: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    ventaId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: "ventas",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
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
    fotoFechaLlamada: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    FechaHoraLlamada: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    fotoLogistica: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    estado: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    observacionLogistica: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    sectorEntrega: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    observacionEntrega: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    fechaHoraAsignacion: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    horaEstimadaEntrega: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    tipoEntrega: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "Entrega",
      validate: {
        isIn: [["Entrega", "Envio"]],
      },
    },
    errores: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: [],
    },
  },
  {
    tableName: "entregas",
    timestamps: true,
  },
);

Entrega.belongsTo(UsuarioAgencia, {
  foreignKey: "usuarioAgenciaId",
  as: "usuarioAgencia",
});

module.exports = Entrega;
