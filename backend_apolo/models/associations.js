const Usuario = require("./Usuario");
const Rol = require("./Rol");
const Agencia = require("./Agencia");
const UsuarioAgencia = require("./UsuarioAgencia");
const Asistencia = require("./Asistencia");
const Postulacion = require("./Postulacion");
const PruebaIntento = require("./PruebaIntento");
const PruebaRespuesta = require("./PruebaRespuesta");
const VacacionPeriodo = require("./VacacionPeriodo");
const VacacionMovimiento = require("./VacacionMovimiento");
const VacacionSolicitud = require("./VacacionSolicitud");
const VacacionSolicitudPeriodo = require("./VacacionSolicitudPeriodo");
const VacacionHistorial = require("./VacacionHistorial");
const VacacionPago = require("./VacacionPago");
const VacacionPagoPeriodo = require("./VacacionPagoPeriodo");

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

Usuario.hasMany(VacacionPeriodo, { foreignKey: "usuarioId", as: "periodosVacacion" });
VacacionPeriodo.belongsTo(Usuario, { foreignKey: "usuarioId", as: "usuario" });
VacacionPeriodo.hasMany(VacacionMovimiento, { foreignKey: "periodoId", as: "movimientos" });
VacacionMovimiento.belongsTo(VacacionPeriodo, { foreignKey: "periodoId", as: "periodo" });

Usuario.hasMany(VacacionSolicitud, { foreignKey: "usuarioId", as: "solicitudesVacacion" });
VacacionSolicitud.belongsTo(Usuario, { foreignKey: "usuarioId", as: "colaborador" });
VacacionSolicitud.belongsTo(Agencia, { foreignKey: "agenciaId", as: "agencia" });
VacacionSolicitud.belongsTo(Usuario, { foreignKey: "reemplazoUsuarioId", as: "reemplazo" });
VacacionSolicitud.belongsTo(Usuario, { foreignKey: "autorId", as: "autor" });
VacacionSolicitud.belongsTo(Usuario, { foreignKey: "aprobadorId", as: "aprobador" });
VacacionSolicitud.hasMany(VacacionSolicitudPeriodo, { foreignKey: "solicitudId", as: "periodosOrigen" });
VacacionSolicitud.hasMany(VacacionHistorial, { foreignKey: "solicitudId", as: "historial" });
VacacionSolicitudPeriodo.belongsTo(VacacionSolicitud, { foreignKey: "solicitudId", as: "solicitud" });
VacacionSolicitudPeriodo.belongsTo(VacacionPeriodo, { foreignKey: "periodoId", as: "periodo" });

Usuario.hasMany(VacacionPago, { foreignKey: "usuarioId", as: "pagosVacacion" });
VacacionPago.belongsTo(Usuario, { foreignKey: "usuarioId", as: "colaborador" });
VacacionPago.hasMany(VacacionPagoPeriodo, { foreignKey: "pagoId", as: "periodosOrigen" });
VacacionPagoPeriodo.belongsTo(VacacionPago, { foreignKey: "pagoId", as: "pago" });
VacacionPagoPeriodo.belongsTo(VacacionPeriodo, { foreignKey: "periodoId", as: "periodo" });
