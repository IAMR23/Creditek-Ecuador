const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

const toUtcDate = (value) => {
  if (!FECHA_RE.test(String(value || ""))) throw new Error("Fecha inválida; use YYYY-MM-DD.");
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.toISOString().slice(0, 10) !== value) throw new Error("Fecha calendario inválida.");
  return date;
};

const formatUtc = (date) => date.toISOString().slice(0, 10);

const contarDiasCalendario = (inicio, fin) => {
  const desde = toUtcDate(inicio);
  const hasta = toUtcDate(fin);
  if (desde > hasta) throw new Error("La fecha inicial no puede superar la fecha final.");
  return Math.round((hasta - desde) / 86400000) + 1;
};

const siguienteDia = (fecha) => {
  const date = toUtcDate(fecha);
  date.setUTCDate(date.getUTCDate() + 1);
  return formatUtc(date);
};

const hoyGuayaquil = (now = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Guayaquil", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
};

const estadoTemporal = ({ fechaInicio, fechaFin }, hoy = hoyGuayaquil()) => {
  if (hoy < fechaInicio) return "PROXIMA";
  if (hoy <= fechaFin) return "EN_CURSO";
  return "FINALIZADA";
};

const validarPeriodoAniversario = ({ fechaIngreso, fechaInicio, fechaFin, hoy = hoyGuayaquil() }) => {
  toUtcDate(fechaIngreso); toUtcDate(fechaInicio); toUtcDate(fechaFin);
  if (fechaInicio < fechaIngreso) throw new Error("El período no puede iniciar antes del ingreso.");
  let aniversario = new Date(toUtcDate(fechaIngreso));
  while (formatUtc(aniversario) < fechaInicio) aniversario.setUTCFullYear(aniversario.getUTCFullYear() + 1);
  if (formatUtc(aniversario) !== fechaInicio) throw new Error("El inicio del período debe coincidir con un aniversario derivado de la fecha de ingreso.");
  const inicio = toUtcDate(fechaInicio);
  const finEsperado = new Date(inicio);
  finEsperado.setUTCFullYear(finEsperado.getUTCFullYear() + 1);
  finEsperado.setUTCDate(finEsperado.getUTCDate() - 1);
  if (fechaFin !== formatUtc(finEsperado)) throw new Error("El fin debe ser el día anterior al siguiente aniversario.");
  return fechaFin < hoy ? "CUMPLIDO" : "FORMACION";
};

const generarPeriodosAniversario = (fechaIngreso, hoy = hoyGuayaquil()) => {
  const ingreso = toUtcDate(fechaIngreso);
  const fechaHoy = toUtcDate(hoy);
  if (ingreso > fechaHoy) throw new Error("La fecha de ingreso no puede estar en el futuro.");
  const periodos = [];
  let anioServicio = 1;
  let inicio = new Date(ingreso);
  while (inicio <= fechaHoy) {
    const siguiente = new Date(inicio);
    siguiente.setUTCFullYear(siguiente.getUTCFullYear() + 1);
    const fin = new Date(siguiente);
    fin.setUTCDate(fin.getUTCDate() - 1);
    const fechaInicio = formatUtc(inicio);
    const fechaFin = formatUtc(fin);
    periodos.push({
      anioServicio,
      fechaInicio,
      fechaFin,
      estado: fechaFin < hoy ? "CUMPLIDO" : "FORMACION",
      diasOrdinariosSugeridos: fechaFin < hoy ? 15 : 0,
      diasAdicionalesMaximos: fechaFin < hoy ? Math.min(15, Math.max(0, anioServicio - 5)) : 0,
    });
    inicio = siguiente;
    anioServicio += 1;
  }
  return periodos;
};

const resumenMovimientos = (movimientos = []) => {
  const sum = (categoria) => movimientos
    .filter((item) => item.categoria === categoria)
    .reduce((total, item) => total + Number(item.dias), 0);
  const reconocidosOrdinarios = sum("RECONOCIDO_ORDINARIO");
  const reconocidosAdicionales = sum("RECONOCIDO_ADICIONAL");
  const disfrutados = sum("DISFRUTADO");
  const comprometidos = sum("COMPROMETIDO");
  const reservadosCompensacion = sum("RESERVADO_COMPENSACION");
  const compensados = sum("COMPENSADO");
  const disponibles = reconocidosOrdinarios + reconocidosAdicionales - disfrutados - comprometidos - reservadosCompensacion - compensados;
  return {
    reconocidosOrdinarios,
    reconocidosAdicionales,
    reconocidos: reconocidosOrdinarios + reconocidosAdicionales,
    disfrutados,
    comprometidos,
    reservadosCompensacion,
    compensados,
    disponibles,
    adicionalesDisponibles: Math.max(0, Math.min(disponibles, reconocidosAdicionales - reservadosCompensacion - compensados)),
  };
};

const validarAsignaciones = ({ asignaciones, cantidadDias, periodos, motivoPrioridad }) => {
  if (!Array.isArray(asignaciones) || asignaciones.length === 0) throw new Error("Seleccione al menos un período de origen.");
  const ids = new Set();
  const total = asignaciones.reduce((sum, item) => {
    const id = Number(item.periodoId); const dias = Number(item.dias);
    if (!Number.isInteger(id) || dias <= 0) throw new Error("La distribución por período es inválida.");
    if (ids.has(id)) throw new Error("No repita un período de origen.");
    ids.add(id); return sum + dias;
  }, 0);
  if (Math.abs(total - Number(cantidadDias)) > 0.001) throw new Error("Los días distribuidos deben coincidir con la solicitud.");
  const elegibles = periodos.filter((p) => Number(p.disponibles) > 0).sort((a, b) => a.fechaInicio.localeCompare(b.fechaInicio));
  if (elegibles.length && Number(asignaciones[0].periodoId) !== Number(elegibles[0].id) && !String(motivoPrioridad || "").trim()) {
    throw new Error("Debe indicar el motivo para no consumir primero el período más antiguo.");
  }
  return total;
};

const seSuperponen = (aInicio, aFin, bInicio, bFin) => aInicio <= bFin && aFin >= bInicio;

const distribuirConsumo = (asignaciones, objetivo, consumidoPorPeriodo = {}) => {
  let restante = Number(objetivo);
  const resultado = [];
  for (const item of asignaciones) {
    if (restante <= 0) break;
    const previo = Number(consumidoPorPeriodo[item.periodoId] || 0);
    const delta = Math.max(0, Math.min(Number(item.dias) - previo, restante));
    if (delta) resultado.push({ periodoId: Number(item.periodoId), dias: delta });
    restante -= delta;
  }
  if (restante > 0.001) throw new Error("Las asignaciones no cubren el consumo requerido.");
  return resultado;
};

const combinarMarcaVacacion = (movimiento, solicitudId) => movimiento
  ? { ...movimiento, vacacion: true, conflictoVacacion: true, solicitudVacacionId: solicitudId }
  : { estado: "vacaciones", observacion: "Vacación aprobada", vacacion: true, conflictoVacacion: false, solicitudVacacionId: solicitudId };

module.exports = {
  combinarMarcaVacacion, contarDiasCalendario, distribuirConsumo, estadoTemporal,
  generarPeriodosAniversario,
  hoyGuayaquil, siguienteDia, resumenMovimientos, seSuperponen,
  validarAsignaciones, validarPeriodoAniversario,
};
