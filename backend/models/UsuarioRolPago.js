const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const Usuario = require("./Usuario");
const RolPago = require("./RolPago");

const UsuarioRolPago = sequelize.define(
  "UsuarioRolPago",
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
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    rolPagoId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "rol_pago_id",
      references: { model: RolPago, key: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
  },
  {
    timestamps: false,
    tableName: "usuarios_roles_pago",
    indexes: [
      {
        unique: true,
        fields: ["usuario_id", "rol_pago_id"],
      },
    ],
  },
);

Usuario.belongsToMany(RolPago, {
  through: UsuarioRolPago,
  foreignKey: "usuarioId",
  otherKey: "rolPagoId",
  as: "rolesPago",
});

RolPago.belongsToMany(Usuario, {
  through: UsuarioRolPago,
  foreignKey: "rolPagoId",
  otherKey: "usuarioId",
  as: "usuariosConRolesPago",
});

UsuarioRolPago.belongsTo(Usuario, {
  foreignKey: "usuarioId",
  as: "usuario",
});

UsuarioRolPago.belongsTo(RolPago, {
  foreignKey: "rolPagoId",
  as: "rolPago",
});

module.exports = UsuarioRolPago;
