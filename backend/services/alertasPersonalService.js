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

const obtenerFechaHoraEcuador = (fecha) => {
  if (!fecha) return null;

  const valor = fecha instanceof Date ? fecha : new Date(fecha);
  return Number.isNaN(valor.getTime()) ? null : formatearFecha(valor);
};

const sumarDiasFecha = (fecha, cantidadDias) => {
  const fechaNormalizada = normalizarFecha(fecha);
  if (!fechaNormalizada) return null;

  const [anio, mes, dia] = fechaNormalizada.split("-").map(Number);
  const resultado = new Date(Date.UTC(anio, mes - 1, dia));
  resultado.setUTCDate(resultado.getUTCDate() + Number(cantidadDias || 0));

  return resultado.toISOString().slice(0, 10);
};

const obtenerRangoDiaEcuador = (fecha) => {
  const fechaNormalizada = normalizarFecha(fecha);
  if (!fechaNormalizada) return null;

  const inicio = new Date(`${fechaNormalizada}T00:00:00-05:00`);
  return {
    inicio,
    fin: new Date(inicio.getTime() + 24 * 60 * 60 * 1000),
  };
};

const construirAlertasPersonal = (usuarios = [], fechaActual) => {
  const hoy = normalizarFecha(fechaActual) || obtenerFechaActualEcuador();
  const alertas = [];

  usuarios.forEach((usuario) => {
    const datos = typeof usuario?.get === "function" ? usuario.get({ plain: true }) : usuario;
    const fechaIngreso = normalizarFecha(datos?.fechaIngreso);
    const fechaSalida = normalizarFecha(datos?.fechaSalida);
    const fechaCreacion = obtenerFechaHoraEcuador(datos?.createdAt);
    const fechaSalidaRegistrada = obtenerFechaHoraEcuador(
      datos?.fechaSalidaRegistradaAt,
    );
    const fechaBaseIngreso = fechaIngreso || fechaCreacion;
    const nombre = String(datos?.nombre || "Persona sin nombre").trim();

    if (fechaCreacion === hoy) {
      alertas.push({
        id: `USUARIO_CREADO-${datos.id}-${hoy}`,
        tipo: "USUARIO_CREADO",
        titulo: "Nuevo usuario creado",
        mensaje: `${nombre} fue registrado en la sección de Administración.`,
        usuarioId: datos.id,
        nombre,
        fechaReferencia: fechaCreacion,
        fechaEvento: hoy,
        prioridad: "success",
      });
    }

    if (
      datos?.activo !== false &&
      fechaBaseIngreso &&
      sumarDiasFecha(fechaBaseIngreso, 15) === hoy
    ) {
      alertas.push({
        id: `INGRESO_15_DIAS-${datos.id}-${hoy}`,
        tipo: "INGRESO_15_DIAS",
        titulo: "15 días desde el ingreso",
        mensaje: fechaIngreso
          ? `${nombre} cumple hoy 15 días desde su fecha de ingreso.`
          : `${nombre} cumple hoy 15 días desde la creación de su usuario.`,
        usuarioId: datos.id,
        nombre,
        fechaReferencia: fechaBaseIngreso,
        fechaEvento: hoy,
        prioridad: "info",
      });
    }

    if (fechaSalida && fechaSalidaRegistrada === hoy) {
      alertas.push({
        id: `FECHA_SALIDA-${datos.id}-${hoy}`,
        tipo: "FECHA_SALIDA",
        titulo: "Fecha de salida registrada",
        mensaje: `Se registró la fecha de salida de ${nombre}.`,
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
    const orden = {
      FECHA_SALIDA: 0,
      USUARIO_CREADO: 1,
      INGRESO_15_DIAS: 2,
    };
    return (orden[a.tipo] ?? 99) - (orden[b.tipo] ?? 99);
  });
};

module.exports = {
  construirAlertasPersonal,
  obtenerFechaActualEcuador,
  obtenerRangoDiaEcuador,
  sumarDiasFecha,
};
