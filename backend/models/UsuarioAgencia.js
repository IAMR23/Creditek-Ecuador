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
    rolAgencia: {
      type: DataTypes.ENUM("encargado", "vendedor", "repartidor"),
      defaultValue: "vendedor",
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

// Relaciones Many-to-Many con alias explícito
Usuario.belongsToMany(Agencia, {
  through: UsuarioAgencia,
  foreignKey: "usuarioId",
  as: "agencias"
});

Agencia.belongsToMany(Usuario, {
  through: UsuarioAgencia,
  foreignKey: "agenciaId",
  as: "usuarios"
});

// Relaciones directas para poder hacer include desde UsuarioAgencia con alias
UsuarioAgencia.belongsTo(Usuario, { foreignKey: "usuarioId", as: "usuario" });
UsuarioAgencia.belongsTo(Agencia, { foreignKey: "agenciaId", as: "agencia" });

module.exports = UsuarioAgencia;
