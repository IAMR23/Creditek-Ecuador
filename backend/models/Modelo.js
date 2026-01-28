// models/Modelo.js
const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const DispositivoMarca = require("./DispositivoMarca"); // Relación correcta

const Modelo = sequelize.define(
  "Modelo",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    nombre: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    descripcion: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    activo: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },

    PVP1: {
  type: DataTypes.DOUBLE,
  allowNull: false,
  defaultValue: 0,
},

    // 🔥 La relación correcta (UN modelo pertenece a UNA combinación dispositivo-marca)
    dispositivoMarcaId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: DispositivoMarca, 
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },
  },
  {
    timestamps: true,
    tableName: "modelos",
  }
);

module.exports = Modelo;
