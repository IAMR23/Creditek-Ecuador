const {
  isCargoPagoComisionable,
  calculateSalesPenalty,
  calculateMonthlyBonus,
  isActiveDuringWeek,
  isFutureCommercialWeek,
} = require("./pagosComisionesService");

describe("pagosComisionesService", () => {
  test("incluye usuarios con cargo salarial vendedor de piso aunque el nivel no venga como ASISTENTE", () => {
    expect(
      isCargoPagoComisionable({
        rolPagoId: 2,
        cargo: "Vendedor de Piso",
        nivel: "",
      }),
    ).toBe(true);
  });

  test("incluye vendedor de call center y asistente vendedor", () => {
    expect(
      isCargoPagoComisionable({
        rolPagoId: 3,
        cargo: "Vendedor de Call Center",
        nivel: "ASISTENTE",
      }),
    ).toBe(true);

    expect(
      isCargoPagoComisionable({
        rolPagoId: 4,
        cargo: "Asistente Vendedor",
        nivel: "OPERATIVO",
      }),
    ).toBe(true);
  });

  test("excluye usuarios sin rol de pago o con cargo no comisionable", () => {
    expect(
      isCargoPagoComisionable({
        rolPagoId: null,
        cargo: "Vendedor de Piso",
        nivel: "ASISTENTE",
      }),
    ).toBe(false);

    expect(
      isCargoPagoComisionable({
        rolPagoId: 9,
        cargo: "Supervisor de Piso",
        nivel: "ENCARGADO",
      }),
    ).toBe(false);
  });

  test("no cumple metas usa minimo y valor por unidad de sanciones", () => {
    const config = { minimoUnidades: 9, valorMultaUnidad: 8 };
    expect(calculateSalesPenalty({ config, unidadesVendidas: 7 })).toBe(16);
    expect(calculateSalesPenalty({ config, unidadesVendidas: 9 })).toBe(0);
    expect(calculateSalesPenalty({ config, unidadesVendidas: 12 })).toBe(0);
  });

  test("el bono mensual aplica equipo extra solo despues de la ultima meta", () => {
    const rules = {
      tiers: [
        { min: 48, bono: 60 },
        { min: 52, bono: 81 },
        { min: 60, bono: 100 },
      ],
      extraPorEquipo: 1.75,
    };

    expect(calculateMonthlyBonus({ rules, venden: 47 })).toBe(0);
    expect(calculateMonthlyBonus({ rules, venden: 48 })).toBe(60);
    expect(calculateMonthlyBonus({ rules, venden: 51 })).toBe(60);
    expect(calculateMonthlyBonus({ rules, venden: 52 })).toBe(81);
    expect(calculateMonthlyBonus({ rules, venden: 59 })).toBe(81);
    expect(calculateMonthlyBonus({ rules, venden: 60 })).toBe(100);
    expect(calculateMonthlyBonus({ rules, venden: 61 })).toBe(101.75);
    expect(calculateMonthlyBonus({ rules, venden: 62 })).toBe(103.5);
  });

  test("no considera semanas anteriores al ingreso ni posteriores a la salida", () => {
    expect(isActiveDuringWeek({ fechaIngreso: "2026-07-24", week: { startDate: "2026-07-02", endDate: "2026-07-08" } })).toBe(false);
    expect(isActiveDuringWeek({ fechaIngreso: "2026-07-24", week: { startDate: "2026-07-23", endDate: "2026-07-29" } })).toBe(true);
    expect(isActiveDuringWeek({ fechaSalida: "2026-07-10", week: { startDate: "2026-07-16", endDate: "2026-07-22" } })).toBe(false);
  });

  test("identifica semanas comerciales que aun no han iniciado", () => {
    expect(isFutureCommercialWeek({ startDate: "2026-07-09" }, "2026-07-10")).toBe(false);
    expect(isFutureCommercialWeek({ startDate: "2026-07-16" }, "2026-07-10")).toBe(true);
  });
});
