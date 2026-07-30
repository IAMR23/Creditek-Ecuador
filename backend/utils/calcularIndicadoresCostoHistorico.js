const redondearDosDecimales = (valor) =>
  Number((Math.round((valor + Number.EPSILON) * 100) / 100).toFixed(2));

const normalizarNumero = (valor) => {
  if (valor === null || valor === undefined || valor === "") return null;

  const numero = Number(
    typeof valor === "string" ? valor.replace(",", ".") : valor,
  );

  return Number.isFinite(numero) ? numero : null;
};

const calcularIndicadoresCostoHistorico = (precioVenta, costo) => {
  const precioVentaNum = normalizarNumero(precioVenta);
  const costoNum = normalizarNumero(costo);

  if (precioVentaNum === null || costoNum === null) {
    return {
      margen: null,
      margenPorcentual: null,
      utilidad: null,
      utilidadSobreCosto: null,
      rentabilidad: null,
    };
  }

  const utilidad = redondearDosDecimales(precioVentaNum - costoNum);
  const utilidadSobreCosto =
    costoNum > 0
      ? redondearDosDecimales((utilidad / costoNum) * 100)
      : null;

  return {
    margen: utilidad,
    margenPorcentual:
      precioVentaNum > 0
        ? redondearDosDecimales((utilidad / precioVentaNum) * 100)
        : null,
    utilidad,
    utilidadSobreCosto,
    rentabilidad: utilidadSobreCosto,
  };
};

module.exports = { calcularIndicadoresCostoHistorico };
