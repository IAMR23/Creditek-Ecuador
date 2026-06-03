exports.calcularEstadisticasVentas = (ventas = []) => {
  const stats = {
    totalVentas: ventas.length,

    porVendedor: {},
    porAgencia: {},
    porOrigen: {},
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

  const normalizarTexto = (valor) => {
    if (valor === null || valor === undefined) return "";
    return String(valor).trim();
  };

  const crearFechaLocal = (fechaInput) => {
    if (!fechaInput) return null;

    if (typeof fechaInput === "string") {
      const soloFecha = fechaInput.split("T")[0];
      const [year, month, day] = soloFecha.split("-").map(Number);

      if (!year || !month || !day) return null;

      return new Date(year, month - 1, day);
    }

    if (fechaInput instanceof Date) {
      return new Date(
        fechaInput.getFullYear(),
        fechaInput.getMonth(),
        fechaInput.getDate()
      );
    }

    return null;
  };

  const formatearFechaLocal = (fechaInput) => {
    const fecha = crearFechaLocal(fechaInput);
    if (!fecha) return null;

    const year = fecha.getFullYear();
    const month = String(fecha.getMonth() + 1).padStart(2, "0");
    const day = String(fecha.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  };

  // Semana comercial:
  // Semana 1 = 01 enero al 07 enero
  // Semana 2 = 08 enero al 14 enero
  // Semana 3 = 15 enero al 21 enero
  // etc.
  const getSemanaComercial = (fechaInput) => {
    const fecha = crearFechaLocal(fechaInput);
    if (!fecha) return null;

    const inicioAnio = new Date(fecha.getFullYear(), 0, 1);

    const fechaNormalizada = new Date(
      fecha.getFullYear(),
      fecha.getMonth(),
      fecha.getDate()
    );

    const inicioNormalizado = new Date(
      inicioAnio.getFullYear(),
      inicioAnio.getMonth(),
      inicioAnio.getDate()
    );

    const msPorDia = 24 * 60 * 60 * 1000;

    const diferenciaDias = Math.floor(
      (fechaNormalizada - inicioNormalizado) / msPorDia
    );

    if (diferenciaDias < 0) return null;

    return Math.floor(diferenciaDias / 7) + 1;
  };

  ventas.forEach((v) => {
    const vendedor = normalizarTexto(v.vendedor);
    if (vendedor) {
      stats.porVendedor[vendedor] = (stats.porVendedor[vendedor] || 0) + 1;
    }

    // Semana comercial calculada desde la fecha real
    if (v.fecha) {
      const semanaCalculada = getSemanaComercial(v.fecha);

      if (semanaCalculada) {
        const key = `Semana ${semanaCalculada}`;
        stats.porSemana[key] = (stats.porSemana[key] || 0) + 1;
      }
    }

    const tipo = normalizarTexto(v.tipo);
    const modelo = normalizarTexto(v.modelo);

    if (tipo && modelo) {
      const key = `${tipo}||${modelo}`;
      stats.porTipoModelo[key] = (stats.porTipoModelo[key] || 0) + 1;
    }

    const local = normalizarTexto(v.local);
    if (local) {
      stats.porAgencia[local] = (stats.porAgencia[local] || 0) + 1;
    }

    const origen = normalizarTexto(v.origen);
    if (origen) {
      stats.porOrigen[origen] = (stats.porOrigen[origen] || 0) + 1;
    }

    if (v.fecha) {
      const fechaKey = formatearFechaLocal(v.fecha);

      if (fechaKey) {
        stats.porFecha[fechaKey] = (stats.porFecha[fechaKey] || 0) + 1;
      }
    }

    const dia = normalizarTexto(v.dia);
    if (dia) {
      stats.porDia[dia] = (stats.porDia[dia] || 0) + 1;
    }

    const marca = normalizarTexto(v.marca);
    if (marca) {
      stats.porMarca[marca] = (stats.porMarca[marca] || 0) + 1;
    }

    if (modelo) {
      stats.porModelo[modelo] = (stats.porModelo[modelo] || 0) + 1;
    }

    if (tipo) {
      stats.porTipo[tipo] = (stats.porTipo[tipo] || 0) + 1;
    }

    const cierreCaja = normalizarTexto(v.cierreCaja);
    if (cierreCaja) {
      stats.porCierreCaja[cierreCaja] =
        (stats.porCierreCaja[cierreCaja] || 0) + 1;
    }

    const observacion = normalizarTexto(v.observacion);
    if (observacion) {
      stats.porObservacion[observacion] =
        (stats.porObservacion[observacion] || 0) + 1;
    }
  });

  return stats;
};