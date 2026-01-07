// utils/calcularEstadisticasVentas.js

exports.calcularEstadisticasVentas = (ventas = []) => {
  const stats = {
    totalVentas: ventas.length,
    //montoTotal: 0,

    porVendedor: {},
    porAgencia: {},
    porFecha: {},
    porDia: {},
    porMarca: {},
    porModelo: {},
    porTipo: {},
  };

  ventas.forEach(v => {
   // const monto = Number(v.precioSistema) || 0;

   // stats.montoTotal += monto;

    // 👤 Vendedor
    if (v.vendedor) {
      stats.porVendedor[v.vendedor] =
        (stats.porVendedor[v.vendedor] || 0) + 1;
    }

    // 🏢 Agencia / Local
    if (v.local) {
      stats.porAgencia[v.local] =
        (stats.porAgencia[v.local] || 0) + 1;
    }

    // 📅 Fecha
    if (v.fecha) {
      stats.porFecha[v.fecha] =
        (stats.porFecha[v.fecha] || 0) + 1;
    }

    // 📆 Día
    if (v.dia) {
      stats.porDia[v.dia] =
        (stats.porDia[v.dia] || 0) + 1;
    }

    // 🏷️ Marca
    if (v.marca) {
      stats.porMarca[v.marca] =
        (stats.porMarca[v.marca] || 0) + 1;
    }

    // 📦 Modelo
    if (v.modelo) {
      stats.porModelo[v.modelo] =
        (stats.porModelo[v.modelo] || 0) + 1;
    }

    // 📱 Tipo
    if (v.tipo) {
      stats.porTipo[v.tipo] =
        (stats.porTipo[v.tipo] || 0) + 1;
    }
  });

  return stats;
};
