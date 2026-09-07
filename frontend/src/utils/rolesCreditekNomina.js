const numero = (value) => {
  const parsed = Number(String(value ?? 0).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
};
const redondear = (value) => Number(value.toFixed(2));

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
  const sancionMeta = numero(row.descuentosMetaCalculado);
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
  const sueldosExtras = row.sueldosExtrasManual != null ? redondear(numero(row.sueldosExtrasManual)) : calculo.sueldosExtras;
  const fondosReserva = row.fondosReservaManual != null ? redondear(numero(row.fondosReservaManual))
    : row.fondoReservaActivo ? redondear(((calculo.tieneMaternidad ? calculo.salario : calculo.sueldoAPagar) + sueldosExtras) / 12) : 0;
  const totalIngresos = redondear(calculo.sueldoAPagar + sueldosExtras + fondosReserva + numero(row.ingresosComisiones));
  const iess = calculo.tieneMaternidad ? calculo.iess : redondear(totalIngresos * 0.0945);
  const egresos = calcularEgresosNomina(row, iess);
  const valorRecibir = redondear(totalIngresos - egresos.totalEgresos);
  return { ...row, ...calculo, ...egresos, fondosReserva, sueldosExtras, totalIngresos,
    totalIngresosEmpresa: totalIngresos, iess, valorRecibir, valorRecibirEmpresa: valorRecibir };
};
