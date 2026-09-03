const Usuario = require("./Usuario");
const Rol = require("./Rol");
const Agencia = require("./Agencia");
const UsuarioAgencia = require("./UsuarioAgencia");
const Asistencia = require("./Asistencia");
const Postulacion = require("./Postulacion");
const PruebaIntento = require("./PruebaIntento");
const PruebaRespuesta = require("./PruebaRespuesta");

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

Postulacion.belongsTo(Usuario, { foreignKey: "entrevistadorId", as: "entrevistador" });
Usuario.hasMany(Postulacion, { foreignKey: "entrevistadorId", as: "entrevistasAsignadas" });

Usuario.hasMany(PruebaIntento, { foreignKey: "usuarioId", as: "intentosPrueba" });
PruebaIntento.belongsTo(Usuario, { foreignKey: "usuarioId", as: "participante" });

Usuario.hasMany(PruebaIntento, {
  foreignKey: "supervisorId",
  as: "pruebasCalificadas",
});
PruebaIntento.belongsTo(Usuario, {
  foreignKey: "supervisorId",
  as: "supervisor",
});

PruebaIntento.hasMany(PruebaRespuesta, {
  foreignKey: "intentoId",
  as: "respuestas",
  onDelete: "CASCADE",
});
PruebaRespuesta.belongsTo(PruebaIntento, {
  foreignKey: "intentoId",
  as: "intento",
});
