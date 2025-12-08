const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const Usuario = require("./Usuario");
const Agencia = require("./Agencia");

const UsuarioAgencia = sequelize.define(
  "UsuarioAgencia",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    usuarioId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "usuarios", // string con el nombre de la tabla
        key: "id",
      },
      onDelete: "CASCADE",
    },
    agenciaId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "agencias", // string con el nombre de la tabla
        key: "id",
      },
      onDelete: "CASCADE",
    },
    
    activo: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    timestamps: true,
    tableName: "usuario_agencia",
    indexes: [
      {
        unique: true,
        fields: ["usuarioId", "agenciaId"], // evita duplicados
      },
    ],
  }
);


module.exports = UsuarioAgencia;
