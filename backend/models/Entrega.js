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
      type: DataTypes.DATE,
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
      type: DataTypes.STRING,
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
    }
    
  },
  { 
    tableName: "entregas",  
    timestamps: true,
  }   
);
 
Entrega.belongsTo(UsuarioAgencia, {
  foreignKey: "usuarioAgenciaId",
  as: "usuarioAgencia",
});

module.exports = Entrega;
