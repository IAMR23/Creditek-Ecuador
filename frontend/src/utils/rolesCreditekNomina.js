const numero = (value) => {
  const parsed = Number(String(value ?? 0).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
};
const redondear = (value) => Number(value.toFixed(2));

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
