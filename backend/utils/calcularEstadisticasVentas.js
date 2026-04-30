exports.calcularEstadisticasVentas = (ventas = []) => {
  const stats = {
    totalVentas: ventas.length,

    porVendedor: {},
    porAgencia: {},
    porOrigen: {}, // ✅ AÑADIDO
    porFecha: {},
    porDia: {},
    porMarca: {},
    porModelo: {},
    porTipo: {},
    porCierreCaja: {},
    porObservacion: {},
    porTipoModelo: {},
    porSemana: {},
  };

  ventas.forEach((v) => {
    // 👤 Vendedor
    if (v.vendedor) {
      stats.porVendedor[v.vendedor] = (stats.porVendedor[v.vendedor] || 0) + 1;
    }

    if (v.semana) {
      const key = `Semana ${v.semana}`;
      stats.porSemana[key] = (stats.porSemana[key] || 0) + 1;
    }
    if (v.tipo && v.modelo) {
      const key = `${v.tipo}||${v.modelo}`; // separador seguro
      stats.porTipoModelo[key] = (stats.porTipoModelo[key] || 0) + 1;
    }

    // 🏢 Agencia / Local
    if (v.local) {
      stats.porAgencia[v.local] = (stats.porAgencia[v.local] || 0) + 1;
    }

    // 🌐 Origen (Referidos, Redes, Tienda, etc.)
    if (v.origen) {
      stats.porOrigen[v.origen] = (stats.porOrigen[v.origen] || 0) + 1;
    }

    // 📅 Fecha
    if (v.fecha) {
      stats.porFecha[v.fecha] = (stats.porFecha[v.fecha] || 0) + 1;
    }

    // 📆 Día
    if (v.dia) {
      stats.porDia[v.dia] = (stats.porDia[v.dia] || 0) + 1;
    }

    // 🏷️ Marca
    if (v.marca) {
      stats.porMarca[v.marca] = (stats.porMarca[v.marca] || 0) + 1;
    }

    // 📦 Modelo
    if (v.modelo) {
      stats.porModelo[v.modelo] = (stats.porModelo[v.modelo] || 0) + 1;
    }

    // 📱 Tipo
    if (v.tipo) {
      stats.porTipo[v.tipo] = (stats.porTipo[v.tipo] || 0) + 1;
    }
    if (v.cierreCaja) {
      stats.porCierreCaja[v.cierreCaja] =
        (stats.porCierreCaja[v.cierreCaja] || 0) + 1;
    }

    if (v.observacion) {
      stats.porObservacion[v.observacion] =
        (stats.porObservacion[v.observacion] || 0) + 1;
    }
  });

  return stats;
};
