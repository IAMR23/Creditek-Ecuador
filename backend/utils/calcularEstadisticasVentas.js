exports.calcularEstadisticasVentas = (ventas = [], fechaInicio = null) => {
  const stats = {
    totalVentas: ventas.length,
    indicadorGerenciaTotal: 0,
    indicadorEngancheJavierTotal: 0,
    precioVentaTotal: 0,
    costoTotal: 0,
    margenPorcentualTotal: 0,

    porVendedor: {},
    indicadorEngancheJavierPorVendedor: {},
    indicadorEngancheJavierPorSemana: {},
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
    indicadorGerenciaPorSemana: {},
    precioVentaPorSemana: {},
    costoPorSemana: {},
    margenPorcentualPorSemana: {},
  };

  const normalizarTexto = (valor) => {
    if (valor === null || valor === undefined) return "";
    return String(valor).trim();
  };

  const normalizarClave = (valor) =>
    normalizarTexto(valor)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

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

  const normalizarNumero = (...valores) => {
    for (const valor of valores) {
      if (valor === null || valor === undefined || valor === "") continue;

      const numero = Number(String(valor).replace(",", "."));
      if (Number.isFinite(numero)) return numero;
    }

    return 0;
  };

  const getInicioSemanaJueves = (fechaInput) => {
    const fecha =
      crearFechaLocal(fechaInput) || new Date(new Date().getFullYear(), 0, 1);
    const inicio = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());

    while (inicio.getDay() !== 4) {
      inicio.setDate(inicio.getDate() - 1);
    }

    return inicio;
  };

  const inicioSemanas = getInicioSemanaJueves(fechaInicio);

  const getSemanaComercial = (fechaInput) => {
    const fecha = crearFechaLocal(fechaInput);
    if (!fecha) return null;

    const fechaNormalizada = new Date(
      fecha.getFullYear(),
      fecha.getMonth(),
      fecha.getDate()
    );

    const inicioNormalizado = new Date(
      inicioSemanas.getFullYear(),
      inicioSemanas.getMonth(),
      inicioSemanas.getDate()
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

    const observacionValor = v.observacion ?? v.observaciones;
    const observacionNormalizada = normalizarClave(observacionValor);
    const esObservacionJavier = observacionNormalizada === "javier";

    const margen = normalizarNumero(v.margen);
    const precioVenta = normalizarNumero(v.precioVenta, v.precioVendedor);
    const costo = normalizarNumero(v.costo);
    stats.indicadorGerenciaTotal = Number(
      (stats.indicadorGerenciaTotal + margen).toFixed(2)
    );
    stats.precioVentaTotal = Number(
      (stats.precioVentaTotal + precioVenta).toFixed(2)
    );
    stats.costoTotal = Number((stats.costoTotal + costo).toFixed(2));

    // Semana comercial jueves-miercoles calculada desde la fecha real.
    if (v.fecha) {
      const semanaCalculada = getSemanaComercial(v.fecha);

      if (semanaCalculada) {
        const key = `Semana ${semanaCalculada}`;
        stats.porSemana[key] = (stats.porSemana[key] || 0) + 1;
        stats.indicadorGerenciaPorSemana[key] = Number(
          ((stats.indicadorGerenciaPorSemana[key] || 0) + margen).toFixed(2)
        );
        stats.precioVentaPorSemana[key] = Number(
          ((stats.precioVentaPorSemana[key] || 0) + precioVenta).toFixed(2)
        );
        stats.costoPorSemana[key] = Number(
          ((stats.costoPorSemana[key] || 0) + costo).toFixed(2)
        );

        if (esObservacionJavier) {
          stats.indicadorEngancheJavierPorSemana[key] =
            (stats.indicadorEngancheJavierPorSemana[key] || 0) + 1;
        }
      }
    }

    if (esObservacionJavier) {
      stats.indicadorEngancheJavierTotal += 1;

      if (vendedor) {
        stats.indicadorEngancheJavierPorVendedor[vendedor] =
          (stats.indicadorEngancheJavierPorVendedor[vendedor] || 0) + 1;
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

    const observacion = normalizarTexto(v.observacion ?? v.observaciones);
    if (observacion) {
      stats.porObservacion[observacion] =
        (stats.porObservacion[observacion] || 0) + 1;
    }
  });

  const semanasMargen = new Set([
    ...Object.keys(stats.porSemana),
    ...Object.keys(stats.indicadorGerenciaPorSemana),
    ...Object.keys(stats.costoPorSemana),
  ]);

  semanasMargen.forEach((key) => {
    const utilidad = Number(stats.indicadorGerenciaPorSemana[key]) || 0;
    const costo = Number(stats.costoPorSemana[key]) || 0;

    stats.margenPorcentualPorSemana[key] =
      costo === 0 ? 0 : Number(((utilidad / costo) * 100).toFixed(2));
  });

  stats.margenPorcentualTotal =
    stats.costoTotal === 0
      ? 0
      : Number(
          (
            (stats.indicadorGerenciaTotal / stats.costoTotal) *
            100
          ).toFixed(2)
        );

  return stats;
};
