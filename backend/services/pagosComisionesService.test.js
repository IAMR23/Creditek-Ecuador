const {
  isCargoPagoComisionable,
  calculateSalesPenalty,
  calculateMonthlyBonus,
  isActiveDuringWeek,
  isFutureCommercialWeek,
  buildWeeklyRulesByGroup,
  buildMonthlyRulesByGroup,
  calculateCommission,
  calculateLeaderAverage,
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

  test("incluye al jefe comercial para calcular la produccion de sus juniors", () => {
    expect(
      isCargoPagoComisionable({
        rolPagoId: 15,
        cargo: "JEFE COMERCIAL DE PISO",
      }),
    ).toBe(true);
  });

  test("jefe comercial usa los escalones semanales configurados", () => {
    const grouped = buildWeeklyRulesByGroup([
      { grupo: "JEFE COMERCIAL PISO", periodo: "COMISION_SEMANAL", unidadesVendidas: "24", comisionPorEquipo: 1, porcentaje: null },
      { grupo: "JEFE COMERCIAL PISO", periodo: "COMISION_SEMANAL", unidadesVendidas: "26", comisionPorEquipo: 1.5, porcentaje: null },
      { grupo: "JEFE COMERCIAL PISO", periodo: "COMISION_SEMANAL", unidadesVendidas: "28", comisionPorEquipo: 2, porcentaje: null },
      { grupo: "JEFE COMERCIAL PISO", periodo: "COMISION_SEMANAL", unidadesVendidas: "32", comisionPorEquipo: 3, porcentaje: null },
    ]);
    const rules = grouped["JEFE COMERCIAL PISO"];

    expect(calculateCommission({ rules, venden: 24, valorVendido: 0 }).totalComisiones).toBe(24);
    expect(calculateCommission({ rules, venden: 27, valorVendido: 0 }).totalComisiones).toBe(40.5);
    expect(calculateCommission({ rules, venden: 30, valorVendido: 0 }).totalComisiones).toBe(60);
    expect(calculateCommission({ rules, venden: 35, valorVendido: 0 }).totalComisiones).toBe(105);
  });

  test("promedio del jefe usa dispositivos de juniors, semanas y cantidad de juniors", () => {
    expect(
      calculateLeaderAverage({
        totalDispositivos: 117,
        cantidadSemanas: 4,
        cantidadJuniors: 2,
      }),
    ).toBe(14.625);
    expect(
      calculateLeaderAverage({
        totalDispositivos: 117,
        cantidadSemanas: 0,
        cantidadJuniors: 2,
      }),
    ).toBe(0);
  });

  test("bono del jefe usa los limites exactos configurados sin redondear", () => {
    const rules = {
      tiers: [
        { min: 12, bono: 60 },
        { min: 13, bono: 80 },
        { min: 14.5, bono: 100 },
      ],
      extraPorEquipo: 0,
    };

    expect(calculateMonthlyBonus({ rules, venden: 11.99 })).toBe(0);
    expect(calculateMonthlyBonus({ rules, venden: 12 })).toBe(60);
    expect(calculateMonthlyBonus({ rules, venden: 12.99 })).toBe(60);
    expect(calculateMonthlyBonus({ rules, venden: 13 })).toBe(80);
    expect(calculateMonthlyBonus({ rules, venden: 14.49 })).toBe(80);
    expect(calculateMonthlyBonus({ rules, venden: 14.5 })).toBe(100);
  });

  test("bono del jefe se construye desde promedioPorVendedor de configuracion", () => {
    const grouped = buildMonthlyRulesByGroup([
      { grupo: "JEFE COMERCIAL PISO", periodo: "BONO_MENSUAL", promedioPorVendedor: "12", unidadesVendidas: null, bono: 60 },
      { grupo: "JEFE COMERCIAL PISO", periodo: "BONO_MENSUAL", promedioPorVendedor: "13", unidadesVendidas: null, bono: 80 },
      { grupo: "JEFE COMERCIAL PISO", periodo: "BONO_MENSUAL", promedioPorVendedor: "14.50", unidadesVendidas: null, bono: 100 },
    ], 4);
    const rules = grouped["JEFE COMERCIAL PISO"];

    expect(calculateMonthlyBonus({ rules, venden: 12 })).toBe(60);
    expect(calculateMonthlyBonus({ rules, venden: 14.49 })).toBe(80);
    expect(calculateMonthlyBonus({ rules, venden: 14.5 })).toBe(100);
  });

  test("supervisor piso y call center usan la misma logica con sus propias configuraciones", () => {
    const grouped = buildMonthlyRulesByGroup([
      { grupo: "SUPERVISOR PISO", subgrupo: "2 vendedores", periodo: "BONO_MENSUAL", promedioPorVendedor: "12", bono: 60 },
      { grupo: "SUPERVISOR PISO", subgrupo: "2 vendedores", periodo: "BONO_MENSUAL", promedioPorVendedor: "13", bono: 80 },
      { grupo: "SUPERVISOR PISO", subgrupo: "2 vendedores", periodo: "BONO_MENSUAL", promedioPorVendedor: "15", bono: 100 },
      { grupo: "SUPERVISOR CALL CENTER", subgrupo: "2 vendedores", periodo: "BONO_MENSUAL", promedioPorVendedor: "10", bono: 60 },
      { grupo: "SUPERVISOR CALL CENTER", subgrupo: "2 vendedores", periodo: "BONO_MENSUAL", promedioPorVendedor: "11", bono: 80 },
      { grupo: "SUPERVISOR CALL CENTER", subgrupo: "2 vendedores", periodo: "BONO_MENSUAL", promedioPorVendedor: "13", bono: 100 },
    ], 4);

    const promedio = calculateLeaderAverage({
      totalDispositivos: 108,
      cantidadSemanas: 4,
      cantidadJuniors: 2,
    });
    expect(promedio).toBe(13.5);

    expect(calculateMonthlyBonus({ rules: grouped["SUPERVISOR PISO"], venden: promedio })).toBe(80);
    expect(calculateMonthlyBonus({ rules: grouped["SUPERVISOR CALL CENTER"], venden: promedio })).toBe(100);
  });

  test("incluye supervisores en su seccion de pagos", () => {
    expect(
      isCargoPagoComisionable({ rolPagoId: 16, cargo: "SUPERVISOR PISO" }),
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
        cargo: "Supervisor de MKT",
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
