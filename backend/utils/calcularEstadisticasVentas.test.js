const { calcularEstadisticasVentas } = require("./calcularEstadisticasVentas");

describe("calcularEstadisticasVentas", () => {
  test("calcula el margen porcentual semanal desde margen y costo", () => {
    const estadisticas = calcularEstadisticasVentas(
      [
        {
          fecha: "2026-06-11",
          margen: 50,
          precioVenta: 200,
          costo: 100,
        },
      ],
      "2026-06-11"
    );

    expect(estadisticas.indicadorGerenciaPorSemana["Semana 1"]).toBe(50);
    expect(estadisticas.promedioIndicadorGerenciaPorSemana["Semana 1"]).toBe(50);
    expect(estadisticas.precioVentaPorSemana["Semana 1"]).toBe(200);
    expect(estadisticas.costoPorSemana["Semana 1"]).toBe(100);
    expect(estadisticas.margenPorcentualPorSemana["Semana 1"]).toBe(50);
    expect(estadisticas.margenPorcentualTotal).toBe(50);
  });

  test("devuelve 0 cuando no hay costo para evitar division entre cero", () => {
    const estadisticas = calcularEstadisticasVentas(
      [
        {
          fecha: "2026-06-11",
          margen: 50,
          precioVenta: 0,
          costo: 0,
        },
      ],
      "2026-06-11"
    );

    expect(estadisticas.margenPorcentualPorSemana["Semana 1"]).toBe(0);
    expect(estadisticas.margenPorcentualTotal).toBe(0);
  });

  test("no promedia porcentajes individuales, usa total margen sobre total costo", () => {
    const estadisticas = calcularEstadisticasVentas(
      [
        {
          fecha: "2026-06-18",
          margen: 10,
          costo: 100,
        },
        {
          fecha: "2026-06-19",
          margen: 90,
          costo: 100,
        },
        {
          fecha: "2026-06-20",
          margen: 50,
          costo: 300,
        },
      ],
      "2026-06-18",
    );

    expect(estadisticas.indicadorGerenciaPorSemana["Semana 1"]).toBe(150);
    expect(estadisticas.promedioIndicadorGerenciaPorSemana["Semana 1"]).toBe(50);
    expect(estadisticas.costoPorSemana["Semana 1"]).toBe(500);
    expect(estadisticas.margenPorcentualPorSemana["Semana 1"]).toBe(30);
    expect(estadisticas.margenPorcentualTotal).toBe(30);
    expect(estadisticas.debugMargen).toMatchObject({
      totalMargen: 150,
      totalCosto: 500,
      margenPorcentaje: 30,
      cantidadRegistros: 3,
    });
  });

  test("calcula el promedio semanal como margen total dividido para ventas", () => {
    const estadisticas = calcularEstadisticasVentas(
      [
        { fecha: "2026-07-16", margen: 10 },
        { fecha: "2026-07-17", margen: 21 },
      ],
      "2026-07-16",
    );

    expect(estadisticas.porSemana["Semana 1"]).toBe(2);
    expect(estadisticas.indicadorGerenciaPorSemana["Semana 1"]).toBe(31);
    expect(estadisticas.promedioIndicadorGerenciaPorSemana["Semana 1"]).toBe(15.5);
  });

  test("calcula el precio vendedor promedio sobre el numero total de ventas", () => {
    const estadisticas = calcularEstadisticasVentas([
      { precioVendedor: "100.50" },
      { precioVendedor: 200 },
      { precioVendedor: "" },
    ]);

    expect(estadisticas.totalVentas).toBe(3);
    expect(estadisticas.precioVendedorTotal).toBe(300.5);
    expect(estadisticas.precioVendedorPromedio).toBe(100.17);
  });

  test("detecta ventas de Javier por observacion corta y nombre completo", () => {
    const estadisticas = calcularEstadisticasVentas(
      [
        {
          fecha: "2026-08-06",
          vendedor: "Vendedor 1",
          observacion: "javier",
        },
        {
          fecha: "2026-08-07",
          vendedor: "Vendedor 2",
          observacion: "DARWIN JAVIER CACOANGO TOAPANTA",
        },
        {
          fecha: "2026-08-08",
          vendedor: "Vendedor 3",
          observacion: "otro",
        },
      ],
      "2026-08-06",
    );

    expect(estadisticas.indicadorEngancheJavierTotal).toBe(2);
    expect(estadisticas.indicadorEngancheJavierPorSemana["Semana 1"]).toBe(2);
    expect(estadisticas.indicadorEngancheJavierPorVendedor).toEqual({
      "Vendedor 1": 1,
      "Vendedor 2": 1,
    });
  });

  test("devuelve precio vendedor promedio 0 cuando no hay ventas", () => {
    const estadisticas = calcularEstadisticasVentas([]);

    expect(estadisticas.precioVendedorTotal).toBe(0);
    expect(estadisticas.precioVendedorPromedio).toBe(0);
  });
});
