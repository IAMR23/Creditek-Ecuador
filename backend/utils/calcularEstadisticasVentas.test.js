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
});
