const normalizarTexto = (valor) => {
  if (valor === null || valor === undefined) return "";
  return String(valor).trim();
};

const normalizarNumero = (...valores) => {
  for (const valor of valores) {
    if (valor === null || valor === undefined || valor === "") continue;

    const numero = Number(String(valor).replace(",", "."));
    if (Number.isFinite(numero)) return numero;
  }

  return 0;
};

const redondear2 = (valor) => Number((Number(valor) || 0).toFixed(2));

const calcularResumenMargen = (ventas = [], rango = {}) => {
  let totalMargen = 0;
  let totalCosto = 0;
  const ventasUnicas = new Set();
  const detalles = new Set();
  const detallesDuplicados = [];
  const registros = [];

  ventas.forEach((venta) => {
    const margen = normalizarNumero(venta.margen);
    const costo = normalizarNumero(venta.costo);

    totalMargen += margen;
    totalCosto += costo;

    if (venta.id !== undefined && venta.id !== null) {
      ventasUnicas.add(venta.id);
    }

    if (venta.detalleVentaId !== undefined && venta.detalleVentaId !== null) {
      if (detalles.has(venta.detalleVentaId)) {
        detallesDuplicados.push(venta.detalleVentaId);
      }

      detalles.add(venta.detalleVentaId);
    }

    registros.push({
      id: venta.id ?? null,
      detalleVentaId: venta.detalleVentaId ?? null,
      fecha: venta.fecha ?? null,
      agencia: venta.local ?? null,
      vendedor: venta.vendedor ?? null,
      origen: venta.origen ?? null,
      observaciones: venta.observaciones ?? venta.observacion ?? null,
      formaPago: venta.formaPago ?? null,
      cierreCaja: venta.cierreCaja ?? null,
      margen,
      costo,
    });
  });

  totalMargen = redondear2(totalMargen);
  totalCosto = redondear2(totalCosto);

  return {
    totalMargen,
    totalCosto,
    margenPorcentaje:
      totalCosto === 0 ? 0 : redondear2((totalMargen / totalCosto) * 100),
    cantidadRegistros: ventas.length,
    ventasUnicas: ventasUnicas.size,
    detallesUnicos: detalles.size,
    detallesDuplicados,
    registros,
    rangoFechasAplicado: {
      fechaInicio: rango.fechaInicio || null,
      fechaFin: rango.fechaFin || null,
    },
  };
};

exports.calcularResumenMargen = calcularResumenMargen;

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
    promedioIndicadorGerenciaPorSemana: {},
    precioVentaPorSemana: {},
    costoPorSemana: {},
    margenPorcentualPorSemana: {},
    debugMargen: calcularResumenMargen(ventas),
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
    stats.indicadorGerenciaTotal += margen;
    stats.precioVentaTotal += precioVenta;
    stats.costoTotal += costo;

    // Semana comercial jueves-miercoles calculada desde la fecha real.
    if (v.fecha) {
      const semanaCalculada = getSemanaComercial(v.fecha);

      if (semanaCalculada) {
        const key = `Semana ${semanaCalculada}`;
        stats.porSemana[key] = (stats.porSemana[key] || 0) + 1;
        stats.indicadorGerenciaPorSemana[key] =
          (stats.indicadorGerenciaPorSemana[key] || 0) + margen;
        stats.precioVentaPorSemana[key] =
          (stats.precioVentaPorSemana[key] || 0) + precioVenta;
        stats.costoPorSemana[key] = (stats.costoPorSemana[key] || 0) + costo;

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
    const utilidad = redondear2(stats.indicadorGerenciaPorSemana[key]);
    const costo = redondear2(stats.costoPorSemana[key]);
    const ventasSemana = normalizarNumero(stats.porSemana[key]);

    stats.indicadorGerenciaPorSemana[key] = utilidad;
    stats.promedioIndicadorGerenciaPorSemana[key] =
      ventasSemana === 0 ? 0 : redondear2(utilidad / ventasSemana);
    stats.costoPorSemana[key] = costo;
    stats.precioVentaPorSemana[key] = redondear2(stats.precioVentaPorSemana[key]);

    stats.margenPorcentualPorSemana[key] =
      costo === 0 ? 0 : redondear2((utilidad / costo) * 100);
  });

  stats.indicadorGerenciaTotal = redondear2(stats.indicadorGerenciaTotal);
  stats.precioVentaTotal = redondear2(stats.precioVentaTotal);
  stats.costoTotal = redondear2(stats.costoTotal);

  stats.margenPorcentualTotal =
    stats.costoTotal === 0
      ? 0
      : redondear2((stats.indicadorGerenciaTotal / stats.costoTotal) * 100);

  stats.debugMargen = {
    ...stats.debugMargen,
    totalMargen: stats.indicadorGerenciaTotal,
    totalCosto: stats.costoTotal,
    margenPorcentaje: stats.margenPorcentualTotal,
  };

  return stats;
};
