const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const Agencia = require("./Agencia"); // importa el modelo para las asociaciones

const Departamento = sequelize.define(
  "Departamento",
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
      type: DataTypes.STRING,
      allowNull: true,
    },

    // FK a Agencia
    agenciaId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "agencias", // o Agencia
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT", // o "CASCADE" según tu lógica de negocio
    },

    activo: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    timestamps: true,
    tableName: "departamentos",
  }
);

module.exports = Departamento;
