const normalizarFecha = (value) => {
  if (!value) return null;

  const texto = String(value);
  const coincidencia = texto.match(/^\d{4}-\d{2}-\d{2}/);
  if (coincidencia) return coincidencia[0];

  const fecha = new Date(value);
  return Number.isNaN(fecha.getTime())
    ? null
    : fecha.toISOString().slice(0, 10);
};

const seleccionarCostoHistorico = (costos = [], fechaVenta) => {
  const fechaLimite = normalizarFecha(fechaVenta);

  const candidatos = costos.filter((costo) => {
    const fechaCosto = normalizarFecha(costo?.fechaCompra);
    return fechaCosto && (!fechaLimite || fechaCosto <= fechaLimite);
  });

  candidatos.sort((a, b) => {
    const diferenciaFecha = normalizarFecha(b.fechaCompra).localeCompare(
      normalizarFecha(a.fechaCompra),
    );

    return diferenciaFecha || Number(b.id || 0) - Number(a.id || 0);
  });

  return candidatos[0] || null;
};

module.exports = { normalizarFecha, seleccionarCostoHistorico };
