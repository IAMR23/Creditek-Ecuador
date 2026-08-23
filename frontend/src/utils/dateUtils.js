export const PERIODOS_RAPIDOS = [
  { id: "HOY", label: "Hoy" },
  { id: "SEMANA", label: "Esta semana" },
  { id: "SIETE_DIAS", label: "Últimos 7 días" },
  { id: "MES", label: "Este mes" },
];

export const PERIODO_RAPIDO_ANIO = { id: "ANIO", label: "Este año" };

const fechaEcuadorIso = (value = new Date()) =>
  new Date(value).toLocaleDateString("en-CA", {
    timeZone: "America/Guayaquil",
  });

const moverFechaIso = (value, dias) => {
  const [anio, mes, dia] = value.split("-").map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
};

const moverMesIso = (value, meses) => {
  const [anio, mes, dia] = value.split("-").map(Number);
  const primerDiaMesDestino = new Date(Date.UTC(anio, mes - 1 + meses, 1));
  const ultimoDiaMesDestino = new Date(
    Date.UTC(
      primerDiaMesDestino.getUTCFullYear(),
      primerDiaMesDestino.getUTCMonth() + 1,
      0,
    ),
  ).getUTCDate();
  const diaDestino = Math.min(dia, ultimoDiaMesDestino);

  return new Date(
    Date.UTC(
      primerDiaMesDestino.getUTCFullYear(),
      primerDiaMesDestino.getUTCMonth(),
      diaDestino,
    ),
  )
    .toISOString()
    .slice(0, 10);
};

export const getHoyLocal = () => fechaEcuadorIso();

export const obtenerRangoPeriodo = (periodo, ahora = new Date()) => {
  const fechaFin = fechaEcuadorIso(ahora);
  const [anio, mes, dia] = fechaFin.split("-").map(Number);
  let fechaInicio = fechaFin;

  if (periodo === "SEMANA") {
    const diaSemana = new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay();
    const diasDesdeLunes = (diaSemana + 6) % 7;
    fechaInicio = moverFechaIso(fechaFin, -diasDesdeLunes);
  } else if (periodo === "SIETE_DIAS") {
    fechaInicio = moverFechaIso(fechaFin, -6);
  } else if (periodo === "MES") {
    fechaInicio = `${fechaFin.slice(0, 8)}01`;
  } else if (periodo === "MES_ATRAS") {
    fechaInicio = moverMesIso(fechaFin, -1);
  } else if (periodo === "ANIO") {
    fechaInicio = `${fechaFin.slice(0, 4)}-01-01`;
  }

  return { fechaInicio, fechaFin };
};

export const obtenerPeriodoActivo = (
  fechaInicio,
  fechaFin,
  periodos = PERIODOS_RAPIDOS,
  ahora = new Date(),
) =>
  periodos.find(({ id }) => {
    const rango = obtenerRangoPeriodo(id, ahora);
    return rango.fechaInicio === fechaInicio && rango.fechaFin === fechaFin;
  })?.id || "";
