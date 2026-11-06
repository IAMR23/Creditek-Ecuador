const numero = (value) => {
  const parsed = Number(String(value ?? 0).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
};
const redondear = (value) => Number(value.toFixed(2));
const IESS_RATE = 0.0945;
const FONDOS_RESERVA_RATE = 0.0833;

export const factorJornadaNomina = (jornadaLaboral) => {
  if (jornadaLaboral === "medio_tiempo") return 0.5;
  if (jornadaLaboral === "tres_cuartos_tiempo") return 0.75;
  return 1;
};

export const calcularValorPorJornada = (value, jornadaLaboral) =>
  redondear(numero(value) * factorJornadaNomina(jornadaLaboral));

export const cumplioAnioFondosReserva = (fechaIngreso, { anio, mes }) => {
  const match = String(fechaIngreso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const anioPeriodo = Number(anio);
  const mesPeriodo = Number(mes);
  if (
    !match ||
    !Number.isInteger(anioPeriodo) ||
    !Number.isInteger(mesPeriodo) ||
    mesPeriodo < 1 ||
    mesPeriodo > 12
  ) return false;

  const [, anioIngreso, mesIngreso, diaIngreso] = match.map(Number);
  const ingreso = new Date(anioIngreso, mesIngreso - 1, diaIngreso);
  if (
    ingreso.getFullYear() !== anioIngreso ||
    ingreso.getMonth() !== mesIngreso - 1 ||
    ingreso.getDate() !== diaIngreso
  ) return false;
  const ultimoDiaMesAniversario = new Date(
    anioIngreso + 1,
    mesIngreso,
    0,
  ).getDate();
  const aniversario = new Date(
    anioIngreso + 1,
    mesIngreso - 1,
    Math.min(diaIngreso, ultimoDiaMesAniversario),
  );
  const finPeriodo = new Date(anioPeriodo, mesPeriodo, 0);
  return aniversario <= finPeriodo;
};

export const calcularFondosReservaNomina = (
  totalIngresosSinFondos,
  { fechaIngreso, fondoReservaActivo, fondosReservaManual, anio, mes },
) => {
  // Un cero guardado cuando regía el indicador anterior no debe bloquear la
  // nueva regla automática basada en la fecha de ingreso.
  const esCeroHeredado = fondoReservaActivo === false
    && numero(fondosReservaManual) === 0;
  if (fondosReservaManual != null && !esCeroHeredado) {
    return redondear(numero(fondosReservaManual));
  }
  if (!cumplioAnioFondosReserva(fechaIngreso, { anio, mes })) return 0;
  return redondear(numero(totalIngresosSinFondos) * FONDOS_RESERVA_RATE);
};

export const calcularDiasTrabajadosNomina = (diasBase, diasFalta) => {
  const base = Math.max(0, Math.min(30, Math.trunc(numero(diasBase))));
  const faltas = Math.max(0, Math.min(30, Math.trunc(numero(diasFalta))));
  return Math.max(0, base - faltas);
};

export const calcularBaseIessNomina = ({ sueldoAPagar, sueldosExtras, comisionVenta }) =>
  redondear(numero(sueldoAPagar) + numero(sueldosExtras) + numero(comisionVenta));

export const calcularIessNomina = (valores) =>
  valores?.afiliadoIess === false
    ? 0
    : redondear(calcularBaseIessNomina(valores) * IESS_RATE);

export const normalizarIdsNomina = (ids) => Array.isArray(ids)
  ? [...new Set(ids.filter((id) => ["string", "number"].includes(typeof id)).map(String))]
  : [];

// Las filas llegan con el orden habitual por cargo y nombre.
export const ordenarFilasNomina = (rows, prioritarios) => {
  const posiciones = new Map(normalizarIdsNomina(prioritarios).map((id, index) => [id, index]));
  return [...rows].sort((left, right) =>
    (posiciones.get(String(left.usuarioId)) ?? Infinity) -
    (posiciones.get(String(right.usuarioId)) ?? Infinity),
  );
};

export const moverPrioridadNomina = (prioritarios, usuarioId, desplazamiento, rows) => {
  const ids = normalizarIdsNomina(prioritarios);
  const presentes = new Set(rows.map((row) => String(row.usuarioId)));
  const visibles = ids.filter((id) => presentes.has(id));
  const posicion = visibles.indexOf(String(usuarioId));
  const destino = posicion + desplazamiento;
  if (posicion < 0 || destino < 0 || destino >= visibles.length) return ids;
  const origen = ids.indexOf(visibles[posicion]);
  const siguiente = ids.indexOf(visibles[destino]);
  [ids[origen], ids[siguiente]] = [ids[siguiente], ids[origen]];
  return ids;
};

export const calcularEgresosNomina = (row, iess) => {
  // El resumen incluye descuentosMeta (con su posible ajuste manual) en anticipos.
  // Nómina muestra por separado el valor que proviene de Pagos comisiones.
  const anticipo = redondear(numero(row.totalAnticipos) - numero(row.descuentosMeta));
  const prestamo = redondear(numero(row.sumanPrestamos) + numero(row.prestamosEgresos));
  const sancionMeta = row.sancionMetaManual != null
    ? numero(row.sancionMetaManual)
    : numero(row.descuentosMetaCalculado);
  return {
    anticipo,
    prestamo,
    sancionMeta,
    totalEgresos: redondear(numero(iess) + anticipo + prestamo + sancionMeta),
  };
};

// Los días, el sueldo de maternidad y la base IESS provienen del cálculo definitivo del backend.
// Solo actualiza la vista al editar los dos importes manuales ya existentes en Nómina.
export const aplicarCalculoNovedad = (row) => {
  const calculo = row.nominaCalculada;
  if (!calculo?.tipoNovedad) return null;
  const diasFalta = Math.max(0, Math.min(30, Math.trunc(numero(row.diasFalta))));
  const puedeRecalcularDias = calculo.diasSueldoCompletoBase != null || calculo.diasSueldoCompleto != null;
  const diasManuales = row.diasTrabajadosManual == null
    ? null
    : Math.max(0, Math.min(30, Math.trunc(numero(row.diasTrabajadosManual))));
  const diasMaternidad25 = numero(calculo.diasMaternidad25);
  const diasSueldoCompletoBase = numero(calculo.diasSueldoCompletoBase ?? calculo.diasSueldoCompleto);
  const diasSueldoCompleto = diasManuales != null
    ? calculo.tieneMaternidad
      ? Math.min(diasSueldoCompletoBase, Math.max(0, diasManuales - diasMaternidad25))
      : diasManuales
    : puedeRecalcularDias
      ? calcularDiasTrabajadosNomina(diasSueldoCompletoBase, diasFalta)
      : calculo.diasSueldoCompleto;
  const diasTrabajados = diasManuales != null || puedeRecalcularDias
    ? diasMaternidad25 + diasSueldoCompleto
    : calculo.diasTrabajados;
  const sueldoCompletoPeriodo = puedeRecalcularDias
    ? redondear(numero(calculo.salario) * diasSueldoCompleto / 30)
    : calculo.sueldoCompletoPeriodo;
  const sueldoAPagar = puedeRecalcularDias
    ? redondear(sueldoCompletoPeriodo + numero(calculo.sueldoMaternidadEmpresa))
    : calculo.sueldoAPagar;
  const sueldosExtras = row.sueldosExtrasManual != null ? redondear(numero(row.sueldosExtrasManual))
    : puedeRecalcularDias
      ? redondear(calcularValorPorJornada(row.rolPagoSueldoExtra, row.jornadaLaboral) * diasTrabajados / 30)
      : numero(calculo.sueldosExtras);
  const comisionVenta = row.comisionVentaManual != null
    ? numero(row.comisionVentaManual)
    : numero(row.ingresosComisiones);
  const totalIngresosSinFondos = redondear(numero(sueldoAPagar) + sueldosExtras + comisionVenta);
  const esFondoReservaCeroHeredado = row.fondoReservaActivo === false
    && numero(row.fondosReservaManual) === 0;
  const fondosReserva = row.fondosReservaManual != null && !esFondoReservaCeroHeredado
    ? redondear(numero(row.fondosReservaManual))
    : calculo.fondoReservaElegible
      ? redondear(totalIngresosSinFondos * FONDOS_RESERVA_RATE)
      : 0;
  const totalIngresos = redondear(totalIngresosSinFondos + fondosReserva);
  const afiliadoIess = row.afiliadoIess !== false;
  const baseIess = afiliadoIess
    ? calculo.tieneMaternidad
      ? numero(calculo.baseIess ?? calculo.salario)
      : calcularBaseIessNomina({ sueldoAPagar, sueldosExtras, comisionVenta })
    : 0;
  const iess = calculo.tieneMaternidad
    ? (afiliadoIess ? calculo.iess : 0)
    : calcularIessNomina({
        sueldoAPagar,
        sueldosExtras,
        comisionVenta,
        afiliadoIess,
      });
  const egresos = calcularEgresosNomina(row, iess);
  const valorRecibir = redondear(totalIngresos - egresos.totalEgresos);
  return { ...row, ...calculo, diasFalta, diasTrabajados, diasSueldoCompleto, sueldoCompletoPeriodo,
    sueldoAPagar, ...egresos, fondosReserva, sueldosExtras, comisionVenta, totalIngresos, baseIess,
    totalIngresosEmpresa: totalIngresos, iess, valorRecibir, valorRecibirEmpresa: valorRecibir };
};
