export const PERIODO_POWER_BI = Object.freeze({
  POR_DEFECTO: "POR_DEFECTO",
  SEMANA: "SEMANA",
  ULTIMOS_7_DIAS: "ULTIMOS_7_DIAS",
  PERSONALIZADO: "PERSONALIZADO",
  MES: "MES",
  ESTE_ANIO: "ESTE_ANIO",
});

export const SEMANAS_POWER_BI_POR_DEFECTO = 13;
const DIAS_RANGO_POWER_BI = SEMANAS_POWER_BI_POR_DEFECTO * 7 - 1;
const MS_POR_DIA = 24 * 60 * 60 * 1000;

export const crearFechaLocal = (fecha) => {
  if (fecha instanceof Date) {
    return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  }

  const [year, month, day] = String(fecha || "").split("-").map(Number);
  if (!year || !month || !day) return null;

  const resultado = new Date(year, month - 1, day);
  if (
    resultado.getFullYear() !== year ||
    resultado.getMonth() !== month - 1 ||
    resultado.getDate() !== day
  ) {
    return null;
  }

  return resultado;
};

export const formatearFechaLocal = (fecha) => {
  const date = crearFechaLocal(fecha);
  if (!date) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

export const sumarDias = (fecha, dias) => {
  const date = crearFechaLocal(fecha);
  if (!date) return null;

  date.setDate(date.getDate() + dias);
  return date;
};

export const getInicioSemanaJueves = (fecha) => {
  const inicio = crearFechaLocal(fecha);
  if (!inicio) return null;

  while (inicio.getDay() !== 4) {
    inicio.setDate(inicio.getDate() - 1);
  }

  return inicio;
};

export const getFinSemanaMiercoles = (fecha) => {
  const inicio = getInicioSemanaJueves(fecha);
  return inicio ? sumarDias(inicio, 6) : null;
};

export const construirRango13SemanasDesdeFin = (fechaReferencia = new Date()) => {
  const fechaFin = getFinSemanaMiercoles(fechaReferencia);
  const fechaInicio = sumarDias(fechaFin, -DIAS_RANGO_POWER_BI);

  return {
    fechaInicio: formatearFechaLocal(fechaInicio),
    fechaFin: formatearFechaLocal(fechaFin),
  };
};

export const esRango13SemanasOperativas = (fechaInicio, fechaFin) => {
  const inicio = crearFechaLocal(fechaInicio);
  const fin = crearFechaLocal(fechaFin);

  if (!inicio || !fin || inicio > fin) return false;
  if (inicio.getDay() !== 4 || fin.getDay() !== 3) return false;

  return Math.round((fin - inicio) / MS_POR_DIA) === DIAS_RANGO_POWER_BI;
};

export const getMesLocal = (fecha = new Date()) => {
  const date = crearFechaLocal(fecha);
  if (!date) return "";

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

export const construirRangoPeriodoPowerBi = ({
  tipo = PERIODO_POWER_BI.POR_DEFECTO,
  fechaReferencia = new Date(),
  mesReferencia = getMesLocal(),
  fechaInicio = "",
  fechaFin = "",
  fechaActual = new Date(),
} = {}) => {
  const hoy = crearFechaLocal(fechaActual) || crearFechaLocal(new Date());

  if (tipo === PERIODO_POWER_BI.SEMANA) {
    const inicio = getInicioSemanaJueves(fechaReferencia) || getInicioSemanaJueves(hoy);
    return {
      fechaInicio: formatearFechaLocal(inicio),
      fechaFin: formatearFechaLocal(sumarDias(inicio, 6)),
    };
  }

  if (tipo === PERIODO_POWER_BI.ULTIMOS_7_DIAS) {
    return {
      fechaInicio: formatearFechaLocal(sumarDias(hoy, -6)),
      fechaFin: formatearFechaLocal(hoy),
    };
  }

  if (tipo === PERIODO_POWER_BI.PERSONALIZADO) {
    return { fechaInicio, fechaFin };
  }

  if (tipo === PERIODO_POWER_BI.MES) {
    const match = String(mesReferencia || "").match(/^(\d{4})-(\d{2})$/);
    const year = Number(match?.[1]);
    const month = Number(match?.[2]);
    const inicio = year && month >= 1 && month <= 12
      ? new Date(year, month - 1, 1)
      : new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const fin = new Date(inicio.getFullYear(), inicio.getMonth() + 1, 0);

    return {
      fechaInicio: formatearFechaLocal(inicio),
      fechaFin: formatearFechaLocal(fin),
    };
  }

  if (tipo === PERIODO_POWER_BI.ESTE_ANIO) {
    return {
      fechaInicio: `${hoy.getFullYear()}-01-01`,
      fechaFin: formatearFechaLocal(hoy),
    };
  }

  return construirRango13SemanasDesdeFin(hoy);
};

export const calcularCantidadSemanasOperativas = (fechaInicio, fechaFin) => {
  const inicio = getInicioSemanaJueves(fechaInicio);
  const fin = crearFechaLocal(fechaFin);
  if (!inicio || !fin || inicio > fin) return 0;

  return Math.floor((fin - inicio) / (MS_POR_DIA * 7)) + 1;
};

export const esPeriodoPowerBiValido = (tipo) =>
  Object.values(PERIODO_POWER_BI).includes(tipo);
