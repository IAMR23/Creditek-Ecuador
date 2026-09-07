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

export const seleccionarFilasNomina = (rows, excluidos) => {
  const ids = new Set(normalizarIdsNomina(excluidos));
  return rows.filter((row) => !ids.has(String(row.usuarioId)));
};

export const cambiarSeleccionNomina = (excluidos, rows, incluir) => {
  const ids = new Set(normalizarIdsNomina(excluidos));
  rows.forEach((row) => {
    const id = String(row.usuarioId);
    if (incluir) ids.delete(id);
    else ids.add(id);
  });
  return [...ids];
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
