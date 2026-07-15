const resolverProcesoLlamada = ({ entrega = {}, archivoPresente, fotoUrl }) => {
  const procesoCompleto = entrega.procesoCompleto === true;

  return {
    procesoCompleto,
    requisitosCompletos:
      procesoCompleto || Boolean(entrega.FechaHoraLlamada && archivoPresente),
    fechaHoraLlamada: procesoCompleto ? null : entrega.FechaHoraLlamada,
    fotoFechaLlamada: procesoCompleto ? null : fotoUrl,
  };
};

const esProcesoCompletoRegistrado = (entrega = {}) =>
  !entrega.FechaHoraLlamada && !entrega.fotoFechaLlamada;

module.exports = { esProcesoCompletoRegistrado, resolverProcesoLlamada };
