const TIME_ZONE_ECUADOR = "America/Guayaquil";

const normalizarFecha = (fecha) => {
  if (!fecha) return null;

  const valor = String(fecha).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(valor) ? valor : null;
};

const formatearFecha = (fecha) => {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE_ECUADOR,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(fecha);
  const valor = Object.fromEntries(
    partes.map(({ type, value }) => [type, value]),
  );

  return `${valor.year}-${valor.month}-${valor.day}`;
};

const obtenerFechaActualEcuador = (ahora = new Date()) => formatearFecha(ahora);

const sumarDiasFecha = (fecha, cantidadDias) => {
  const fechaNormalizada = normalizarFecha(fecha);
  if (!fechaNormalizada) return null;

  const [anio, mes, dia] = fechaNormalizada.split("-").map(Number);
  const resultado = new Date(Date.UTC(anio, mes - 1, dia));
  resultado.setUTCDate(resultado.getUTCDate() + Number(cantidadDias || 0));

  return resultado.toISOString().slice(0, 10);
};

const construirAlertasPersonal = (usuarios = [], fechaActual) => {
  const hoy = normalizarFecha(fechaActual) || obtenerFechaActualEcuador();
  const alertas = [];

  usuarios.forEach((usuario) => {
    const datos = typeof usuario?.get === "function" ? usuario.get({ plain: true }) : usuario;
    const fechaIngreso = normalizarFecha(datos?.fechaIngreso);
    const fechaSalida = normalizarFecha(datos?.fechaSalida);
    const nombre = String(datos?.nombre || "Persona sin nombre").trim();

    if (
      datos?.activo !== false &&
      fechaIngreso &&
      sumarDiasFecha(fechaIngreso, 15) === hoy
    ) {
      alertas.push({
        id: `INGRESO_15_DIAS-${datos.id}-${hoy}`,
        tipo: "INGRESO_15_DIAS",
        titulo: "15 días desde el ingreso",
        mensaje: `${nombre} cumple hoy 15 días desde su fecha de ingreso.`,
        usuarioId: datos.id,
        nombre,
        fechaReferencia: fechaIngreso,
        fechaEvento: hoy,
        prioridad: "info",
      });
    }

    if (fechaSalida === hoy) {
      alertas.push({
        id: `FECHA_SALIDA-${datos.id}-${hoy}`,
        tipo: "FECHA_SALIDA",
        titulo: "Fecha de salida",
        mensaje: `Hoy es la fecha de salida registrada de ${nombre}.`,
        usuarioId: datos.id,
        nombre,
        fechaReferencia: fechaSalida,
        fechaEvento: hoy,
        prioridad: "warning",
      });
    }
  });

  return alertas.sort((a, b) => {
    if (a.tipo === b.tipo) return a.nombre.localeCompare(b.nombre, "es");
    return a.tipo === "FECHA_SALIDA" ? -1 : 1;
  });
};

module.exports = {
  construirAlertasPersonal,
  obtenerFechaActualEcuador,
  sumarDiasFecha,
};
