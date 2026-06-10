const Usuario = require("./Usuario");
const Rol = require("./Rol");
const Agencia = require("./Agencia");
const UsuarioAgencia = require("./UsuarioAgencia");
const Asistencia = require("./Asistencia");
require("./Postulacion");

Usuario.belongsTo(Rol, { foreignKey: "rolId", as: "rol" });
Rol.hasMany(Usuario, { foreignKey: "rolId", as: "usuarios" });

Usuario.belongsToMany(Agencia, {
  through: UsuarioAgencia,
  foreignKey: "usuarioId",
  as: "agencias",
});

Agencia.belongsToMany(Usuario, {
  through: UsuarioAgencia,
  foreignKey: "agenciaId",
  as: "usuarios",
});

UsuarioAgencia.belongsTo(Usuario, { foreignKey: "usuarioId", as: "usuario" });
UsuarioAgencia.belongsTo(Agencia, { foreignKey: "agenciaId", as: "agencia" });

UsuarioAgencia.hasMany(Asistencia, { foreignKey: "usuarioAgenciaId", as: "asistencias" });
Asistencia.belongsTo(UsuarioAgencia, { foreignKey: "usuarioAgenciaId", as: "usuarioAgencia" });
