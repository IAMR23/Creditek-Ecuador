const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const Usuario = require("./Usuario");
const Permiso = require("./Permiso");

const UsuarioPermiso = sequelize.define(
  "UsuarioPermiso",
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
    permisoId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "permiso_id",
      references: { model: Permiso, key: "id" },
      onDelete: "CASCADE",
    },
    activo: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    fechaInicio: {
      type: DataTypes.DATE,
      field: "fecha_inicio",
    },
    fechaFin: {
      type: DataTypes.DATE,
      field: "fecha_fin",
    },
  },
  {
    timestamps: false,
    tableName: "usuarios_permisos",
    indexes: [
      {
        unique: true,
        fields: ["usuario_id", "permiso_id"],
      },
    ],
  },
);

Usuario.hasMany(UsuarioPermiso, {
  foreignKey: "usuario_id",
  as: "permisosAsignados",
});

UsuarioPermiso.belongsTo(Usuario, {
  foreignKey: "usuario_id",
  as: "usuario",
});

Permiso.hasMany(UsuarioPermiso, {
  foreignKey: "permiso_id",
  as: "usuariosAsignados",
});

UsuarioPermiso.belongsTo(Permiso, {
  foreignKey: "permiso_id",
  as: "permiso",
});

module.exports = UsuarioPermiso;
