const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const UsuarioAgencia = require("./UsuarioAgencia");
const Permiso = require("./Permiso");

const UsuarioAgenciaPermiso = sequelize.define(
  "UsuarioAgenciaPermiso",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    usuarioAgenciaId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "usuario_agencia_id",
      references: { model: UsuarioAgencia, key: "id" },
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
    tableName: "usuarios_agencias_permisos",
    indexes: [
      { 
        unique: true,
        fields: ["usuario_agencia_id", "permiso_id"],
      },
    ],
  },
);

// Relaciones
// Relaciones con alias
UsuarioAgencia.hasMany(UsuarioAgenciaPermiso, {
  foreignKey: "usuario_agencia_id",
  as: "permisosAsignados", // alias legible
});
UsuarioAgenciaPermiso.belongsTo(UsuarioAgencia, {
  foreignKey: "usuario_agencia_id",
  as: "usuarioAgencia",
});

Permiso.hasMany(UsuarioAgenciaPermiso, {
  foreignKey: "permiso_id",
  as: "permisosDeUsuario",
});
UsuarioAgenciaPermiso.belongsTo(Permiso, {
  foreignKey: "permiso_id",
  as: "permiso",
});

module.exports = UsuarioAgenciaPermiso;
