const TIPOS_PRESTAMO = ["PLAN_MOVISTAR", "MECANICA", "LENTES", "PRESTAMO_EMPRESARIAL", "CUOTAS_TELEFONO", "OTROS"];
const PERIODO_REGEX = /^(20\d{2}|2100)-(0[1-9]|1[0-2])$/;
const periodoValido = (value) => typeof value === "string" && PERIODO_REGEX.test(value);
const sumarMeses = (periodo, cantidad = 1) => {
  const [anio, mes] = periodo.split("-").map(Number);
  return new Date(Date.UTC(anio, mes - 1 + cantidad, 1)).toISOString().slice(0, 7);
};
const ultimoDiaPeriodo = (periodo) => {
  const [anio, mes] = periodo.split("-").map(Number);
  return new Date(Date.UTC(anio, mes, 0)).toISOString().slice(0, 10);
};
const normalizarProrrogas = (value) => [...new Set((Array.isArray(value) ? value : [])
  .filter(periodoValido))].sort();
const esPlanPrestamo = (registro) => Number.isInteger(Number(registro?.plazoMeses)) &&
  Number(registro.plazoMeses) >= 1 && Number(registro.plazoMeses) <= 120 &&
  Number(registro?.montoTotal) > 0;
const calcularPlanPrestamo = (registro) => {
  if (!esPlanPrestamo(registro)) return [];
  const inicio = String(registro.fecha || registro.createdAt || "").slice(0, 7);
  if (!periodoValido(inicio)) return [];
  const plazo = Number(registro.plazoMeses);
  const totalCentavos = Math.round(Number(registro.montoTotal) * 100);
  const cuotaCentavos = Math.floor(totalCentavos / plazo);
  const prorrogas = new Set(normalizarProrrogas(registro.prorrogas));
  const cuotas = [];
  let periodo = inicio;
  let numeroCuota = 1;
  let guardia = 0;
  while (numeroCuota <= plazo && guardia < 240) {
    if (prorrogas.has(periodo)) {
      cuotas.push({ periodo, valor: 0, estado: "PRORROGA", prorroga: true });
    } else {
      const centavos = numeroCuota === plazo
        ? totalCentavos - cuotaCentavos * (plazo - 1)
        : cuotaCentavos;
      cuotas.push({ periodo, valor: centavos / 100, estado: "RECURRENTE", numeroCuota, plazoMeses: plazo });
      numeroCuota += 1;
    }
    periodo = sumarMeses(periodo);
    guardia += 1;
  }
  return cuotas;
};
const fechaFinPlanPrestamo = (registro) => {
  const ultima = calcularPlanPrestamo(registro).at(-1);
  return ultima ? ultimoDiaPeriodo(ultima.periodo) : null;
};
const cuotaPrestamoDelMes = (registro, { anio, mes }) => {
  if (registro.activo === false || registro.seccion !== "PRESTAMOS") return 0;
  const periodo = `${anio}-${String(mes).padStart(2, "0")}`;
  if (esPlanPrestamo(registro)) {
    return Number(calcularPlanPrestamo(registro).find((cuota) => cuota.periodo === periodo)?.valor || 0);
  }
  const creado = registro.createdAt instanceof Date
    ? new Date(registro.createdAt.getTime() - 5 * 60 * 60 * 1000).toISOString()
    : registro.createdAt;
  const inicio = String(registro.fecha || creado || "").slice(0, 7);
  const fin = String(registro.fechaFin || "").slice(0, 7);
  return inicio && inicio <= periodo && (!fin || periodo <= fin) ? Number(registro.valor || 0) : 0;
};
module.exports = { TIPOS_PRESTAMO, calcularPlanPrestamo, cuotaPrestamoDelMes, esPlanPrestamo,
  fechaFinPlanPrestamo, normalizarProrrogas, periodoValido, sumarMeses, ultimoDiaPeriodo };
