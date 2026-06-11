const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const Usuario = require("./Usuario");
const Rol = require("./Rol");

const UsuarioRol = sequelize.define(
  "UsuarioRol",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    usuarioId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "usuario_id",
      references: { model: Usuario, key: "id" },
      onDelete: "CASCADE",
    },
    rolId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "rol_id",
      references: { model: Rol, key: "id" },
      onDelete: "CASCADE",
    },
    activo: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    timestamps: false,
    tableName: "usuarios_roles",
    indexes: [
      {
        unique: true,
        fields: ["usuario_id", "rol_id"],
      },
    ],
  },
);

Usuario.belongsToMany(Rol, {
  through: UsuarioRol,
  foreignKey: "usuarioId",
  otherKey: "rolId",
  as: "roles",
});

Rol.belongsToMany(Usuario, {
  through: UsuarioRol,
  foreignKey: "rolId",
  otherKey: "usuarioId",
  as: "usuariosConRol",
});

UsuarioRol.belongsTo(Usuario, {
  foreignKey: "usuarioId",
  as: "usuario",
});

UsuarioRol.belongsTo(Rol, {
  foreignKey: "rolId",
  as: "rol",
});

module.exports = UsuarioRol;
