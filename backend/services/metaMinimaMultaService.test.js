const {
  buildCommercialWeeksForRange,
  calculateCompliance,
  getNewPersonnelPenaltyStartDate,
  isApplicableSellerCargo,
  isNewPersonnelDuringWeek,
  resolveApplicableConfig,
} = require("./metaMinimaMultaService");

describe("metaMinimaMultaService", () => {
  test("vendedor de piso con 11 ventas cumple", () => {
    expect(
      calculateCompliance({
        metaMinima: 11,
        ventas: 11,
        valorMultaUnidad: 7,
      }),
    ).toEqual({
      faltan: 0,
      multaEstimada: 0,
      estado: "CUMPLE",
    });
  });

  test("vendedor de piso con 8 ventas genera multa estimada de 21", () => {
    expect(
      calculateCompliance({
        metaMinima: 11,
        ventas: 8,
        valorMultaUnidad: 7,
      }),
    ).toEqual({
      faltan: 3,
      multaEstimada: 21,
      estado: "NO_CUMPLE",
    });
  });

  test("vendedor call center con 9 ventas cumple", () => {
    expect(
      calculateCompliance({
        metaMinima: 9,
        ventas: 9,
        valorMultaUnidad: 7,
      }),
    ).toEqual({
      faltan: 0,
      multaEstimada: 0,
      estado: "CUMPLE",
    });
  });

  test("vendedor call center con 7 ventas genera multa estimada de 14", () => {
    expect(
      calculateCompliance({
        metaMinima: 9,
        ventas: 7,
        valorMultaUnidad: 7,
      }),
    ).toEqual({
      faltan: 2,
      multaEstimada: 14,
      estado: "NO_CUMPLE",
    });
  });

  test("vendedor sin rolPagoId queda sin configuracion", () => {
    expect(
      resolveApplicableConfig(
        { usuarioId: 1, nombre: "Sin rol", rolesPago: [] },
        new Map(),
      ).estado,
    ).toBe("SIN_CONFIGURACION");
  });

  test("rol no aplicable queda como no aplica", () => {
    expect(
      resolveApplicableConfig(
        {
          usuarioId: 2,
          nombre: "Administrativo",
          rolesPago: [{ id: 50, cargo: "ASISTENTE ADMINISTRATIVO" }],
        },
        new Map(),
      ).estado,
    ).toBe("NO_APLICA");
  });

  test("solo considera cargos vendedor piso o vendedor call center como aplicables", () => {
    expect(isApplicableSellerCargo("VENDEDOR DE PISO")).toBe(true);
    expect(isApplicableSellerCargo("VENDEDOR CALL CENTER")).toBe(true);
    expect(isApplicableSellerCargo("ASISTENTE ADMINISTRATIVO")).toBe(false);
    expect(isApplicableSellerCargo("SUPERVISOR PISO")).toBe(false);
  });

  test("dos cargos aplicables no bloquean y priorizan el rol de pago principal", () => {
    const configsByRole = new Map([
      [1, { rolPagoId: 1, minimoUnidades: 11, valorMultaUnidad: 7 }],
      [2, { rolPagoId: 2, minimoUnidades: 9, valorMultaUnidad: 7 }],
    ]);

    expect(
      resolveApplicableConfig(
        {
          usuarioId: 3,
          nombre: "Doble cargo",
          rolPagoId: 2,
          rolesPago: [
            { id: 1, cargo: "VENDEDOR DE PISO" },
            { id: 2, cargo: "VENDEDOR CALL CENTER" },
          ],
        },
        configsByRole,
      ),
    ).toMatchObject({
      estado: null,
      rolPagoId: 2,
      cargo: "VENDEDOR CALL CENTER",
      config: { minimoUnidades: 9, valorMultaUnidad: 7 },
    });
  });

  test("dos semanas se calculan por separado y no compensan sobrantes", () => {
    const weeks = buildCommercialWeeksForRange({
      fechaInicio: "2026-07-02",
      fechaFin: "2026-07-15",
    });
    const ventas = [14, 5];
    const detalle = weeks.map((week, index) => ({
      week,
      ...calculateCompliance({
        metaMinima: 11,
        ventas: ventas[index],
        valorMultaUnidad: 7,
      }),
    }));

    expect(weeks.map((week) => `${week.startDate}/${week.endDate}`)).toEqual([
      "2026-07-02/2026-07-08",
      "2026-07-09/2026-07-15",
    ]);
    expect(detalle[0]).toMatchObject({ faltan: 0, multaEstimada: 0 });
    expect(detalle[1]).toMatchObject({ faltan: 6, multaEstimada: 42 });
    expect(detalle.reduce((total, item) => total + item.multaEstimada, 0)).toBe(42);
  });

  test("personal nuevo no aplica regla durante los primeros 30 dias", () => {
    expect(getNewPersonnelPenaltyStartDate("2026-07-01")).toBe("2026-07-31");
    expect(
      isNewPersonnelDuringWeek({
        fechaIngreso: "2026-07-01",
        week: { startDate: "2026-07-23", endDate: "2026-07-29" },
      }),
    ).toBe(true);
    expect(
      isNewPersonnelDuringWeek({
        fechaIngreso: "2026-07-01",
        week: { startDate: "2026-07-30", endDate: "2026-08-05" },
      }),
    ).toBe(true);
    expect(
      isNewPersonnelDuringWeek({
        fechaIngreso: "2026-07-01",
        week: { startDate: "2026-08-06", endDate: "2026-08-12" },
      }),
    ).toBe(false);
  });
});
