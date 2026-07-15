const {
  seleccionarCostoHistorico,
} = require("./seleccionarCostoHistorico");

describe("seleccionarCostoHistorico", () => {
  const costos = [
    { id: 1, fechaCompra: "2026-01-01", costo: 80 },
    { id: 2, fechaCompra: "2026-06-01", costo: 90 },
    { id: 3, fechaCompra: "2026-08-01", costo: 100 },
  ];

  test("elige el último costo vigente a la fecha de la venta", () => {
    expect(
      seleccionarCostoHistorico(costos, "2026-07-15").costo,
    ).toBe(90);
  });

  test("no utiliza costos posteriores a la venta", () => {
    expect(seleccionarCostoHistorico(costos, "2025-12-31")).toBeNull();
  });

  test("elige el registro con mayor id cuando comparten fecha", () => {
    const resultado = seleccionarCostoHistorico(
      [
        { id: 4, fechaCompra: "2026-06-01", costo: 91 },
        { id: 5, fechaCompra: "2026-06-01", costo: 92 },
      ],
      "2026-07-15",
    );

    expect(resultado.costo).toBe(92);
  });
});
