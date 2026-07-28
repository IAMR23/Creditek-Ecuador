const NotificacionPersonal = require("../models/NotificacionPersonal");
const {
  obtenerFechaActualEcuador,
} = require("./alertasPersonalService");

const obtenerDatosPlanos = (registro) =>
  typeof registro?.get === "function"
    ? registro.get({ plain: true })
    : registro || {};

const normalizarFecha = (fecha) => {
  if (!fecha) return null;

  const valor = String(fecha).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(valor) ? valor : null;
};

const obtenerFechaDesdeDateTime = (fecha) => {
  if (!fecha) return null;

  const valor = fecha instanceof Date ? fecha : new Date(fecha);
  return Number.isNaN(valor.getTime())
    ? null
    : obtenerFechaActualEcuador(valor);
};

const registrarNotificacion = async (datos) => {
  const [notificacion] = await NotificacionPersonal.findOrCreate({
    where: { claveEvento: datos.claveEvento },
    defaults: datos,
  });

  return notificacion;
};

const registrarNotificacionDesdeAlerta = (alerta, origen = "RVE") => {
  const fechaReferencia = normalizarFecha(alerta.fechaReferencia);
  const claveEvento =
    alerta.tipo === "FECHA_SALIDA" && fechaReferencia
      ? `FECHA_SALIDA-${alerta.usuarioId}-${fechaReferencia}`
      : String(alerta.id);

  return registrarNotificacion({
    claveEvento,
    tipo: alerta.tipo,
    titulo: alerta.titulo,
    mensaje: alerta.mensaje,
    usuarioReferenciaId: alerta.usuarioId || null,
    nombreReferencia: alerta.nombre || null,
    fechaReferencia,
    fechaEvento:
      normalizarFecha(alerta.fechaEvento) || obtenerFechaActualEcuador(),
    prioridad: alerta.prioridad || "info",
    origen,
  });
};

const registrarAlertasPersonal = async (alertas = [], origen = "RVE") =>
  Promise.all(
    alertas.map((alerta) => registrarNotificacionDesdeAlerta(alerta, origen)),
  );

const registrarNotificacionUsuarioCreado = (usuario, origen = "RVE") => {
  const datos = obtenerDatosPlanos(usuario);
  const fechaEvento =
    obtenerFechaDesdeDateTime(datos.createdAt) || obtenerFechaActualEcuador();
  const nombre = String(datos.nombre || "Persona sin nombre").trim();

  return registrarNotificacion({
    claveEvento: `USUARIO_CREADO-${datos.id}-${fechaEvento}`,
    tipo: "USUARIO_CREADO",
    titulo: "Nuevo usuario creado",
    mensaje: `${nombre} fue registrado en la sección de Administración.`,
    usuarioReferenciaId: datos.id || null,
    nombreReferencia: nombre,
    fechaReferencia: fechaEvento,
    fechaEvento,
    prioridad: "success",
    origen,
  });
};

const registrarNotificacionSalida = (
  usuario,
  { origen = "RVE", fechaEvento } = {},
) => {
  const datos = obtenerDatosPlanos(usuario);
  const fechaSalida = normalizarFecha(datos.fechaSalida);
  if (!fechaSalida) return Promise.resolve(null);

  const fechaRegistro =
    normalizarFecha(fechaEvento) ||
    obtenerFechaDesdeDateTime(datos.fechaSalidaRegistradaAt) ||
    obtenerFechaActualEcuador();
  const nombre = String(datos.nombre || "Persona sin nombre").trim();

  return registrarNotificacion({
    claveEvento: `FECHA_SALIDA-${datos.id}-${fechaSalida}`,
    tipo: "FECHA_SALIDA",
    titulo: "Salida de usuario registrada",
    mensaje: `Se registró la salida de ${nombre}.`,
    usuarioReferenciaId: datos.id || null,
    nombreReferencia: nombre,
    fechaReferencia: fechaSalida,
    fechaEvento: fechaRegistro,
    prioridad: "warning",
    origen,
  });
};

const registrarNotificacionSegura = async (promesa, contexto) => {
  try {
    return await promesa;
  } catch (error) {
    console.error(
      `No se pudo guardar la notificación de personal (${contexto}):`,
      error,
    );
    return null;
  }
};

module.exports = {
  registrarAlertasPersonal,
  registrarNotificacion,
  registrarNotificacionDesdeAlerta,
  registrarNotificacionSalida,
  registrarNotificacionSegura,
  registrarNotificacionUsuarioCreado,
};
