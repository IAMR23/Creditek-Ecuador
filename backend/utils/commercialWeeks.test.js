const {
  generateAnnualCommercialCalendar,
  getCommercialWeekKey,
  getCommercialWeeksByMonth,
  getRequiredCommercialWeeksForYear,
  validateAnnualCommercialWeeksConfiguration,
} = require("./commercialWeeks");

describe("commercialWeeks", () => {
  test("enero 2026 devuelve 5 semanas jueves a miercoles", () => {
    const weeks = getCommercialWeeksByMonth(2026, 1);

    expect(weeks).toHaveLength(5);
    expect(weeks.map((week) => `${week.startDate}/${week.endDate}`)).toEqual([
      "2026-01-01/2026-01-07",
      "2026-01-08/2026-01-14",
      "2026-01-15/2026-01-21",
      "2026-01-22/2026-01-28",
      "2026-01-29/2026-02-04",
    ]);
  });

  test("junio 2026 devuelve 4 semanas y excluye los dias antes del primer jueves", () => {
    const weeks = getCommercialWeeksByMonth(2026, 6);

    expect(weeks).toHaveLength(4);
    expect(weeks.map((week) => week.label)).toEqual([
      "4 AL 10 DE JUNIO",
      "11 AL 17 DE JUNIO",
      "18 AL 24 DE JUNIO",
      "25 DE JUNIO AL 1 DE JULIO",
    ]);
    expect(getCommercialWeekKey("2026-06-01")).toBe("2026-05-28");
    expect(getCommercialWeekKey("2026-06-04")).toBe("2026-06-04");
  });

  test("julio 2026 devuelve 5 semanas", () => {
    const weeks = getCommercialWeeksByMonth(2026, 7);

    expect(weeks).toHaveLength(5);
    expect(weeks.map((week) => week.label)).toEqual([
      "2 AL 8 DE JULIO",
      "9 AL 15 DE JULIO",
      "16 AL 22 DE JULIO",
      "23 AL 29 DE JULIO",
      "30 DE JULIO AL 5 DE AGOSTO",
    ]);
  });

  test("diciembre 2026 devuelve 5 semanas", () => {
    const weeks = getCommercialWeeksByMonth(2026, 12);

    expect(weeks).toHaveLength(5);
    expect(weeks[0]).toMatchObject({
      startDate: "2026-12-03",
      endDate: "2026-12-09",
    });
    expect(weeks[4]).toMatchObject({
      startDate: "2026-12-31",
      endDate: "2027-01-06",
      monthOwner: 12,
      yearOwner: 2026,
    });
  });

  test("calendario anual configurado asigna meses consecutivos sin huecos", () => {
    const monthsConfig = [
      { mes: 1, cantidadSemanas: 4 },
      { mes: 2, cantidadSemanas: 5 },
      { mes: 3, cantidadSemanas: 4 },
      { mes: 4, cantidadSemanas: 4 },
      { mes: 5, cantidadSemanas: 5 },
      { mes: 6, cantidadSemanas: 4 },
      { mes: 7, cantidadSemanas: 4 },
      { mes: 8, cantidadSemanas: 5 },
      { mes: 9, cantidadSemanas: 4 },
      { mes: 10, cantidadSemanas: 5 },
      { mes: 11, cantidadSemanas: 4 },
      { mes: 12, cantidadSemanas: 4 },
    ];

    const weeks = generateAnnualCommercialCalendar({
      year: 2026,
      monthsConfig,
    });

    expect(getRequiredCommercialWeeksForYear(2026)).toBe(52);
    expect(weeks).toHaveLength(52);
    expect(weeks.filter((week) => week.monthOwner === 1)).toEqual([
      expect.objectContaining({ startDate: "2026-01-01", endDate: "2026-01-07" }),
      expect.objectContaining({ startDate: "2026-01-08", endDate: "2026-01-14" }),
      expect.objectContaining({ startDate: "2026-01-15", endDate: "2026-01-21" }),
      expect.objectContaining({ startDate: "2026-01-22", endDate: "2026-01-28" }),
    ]);
    expect(weeks.filter((week) => week.monthOwner === 2)[0]).toMatchObject({
      startDate: "2026-01-29",
      endDate: "2026-02-04",
    });
    expect(weeks.filter((week) => week.monthOwner === 7)).toHaveLength(4);
    expect(weeks.filter((week) => week.monthOwner === 8)).toHaveLength(5);
    expect(weeks.filter((week) => week.monthOwner === 7).at(-1)).toMatchObject({
      startDate: "2026-07-23",
      endDate: "2026-07-29",
    });
    expect(weeks.filter((week) => week.monthOwner === 8)[0]).toMatchObject({
      startDate: "2026-07-30",
      endDate: "2026-08-05",
    });
    expect(weeks.at(-1)).toMatchObject({
      startDate: "2026-12-24",
      endDate: "2026-12-30",
      monthOwner: 12,
    });

    weeks.slice(1).forEach((week, index) => {
      expect(getCommercialWeekKey(week.startDate)).toBe(week.startDate);
      const previous = weeks[index];
      const expectedStart = new Date(`${previous.endDate}T00:00:00`);
      expectedStart.setDate(expectedStart.getDate() + 1);
      expect(week.startDate).toBe(expectedStart.toISOString().slice(0, 10));
    });
  });

  test("rechaza configuracion anual con suma incompatible", () => {
    const monthsConfig = Array.from({ length: 12 }, (_, index) => ({
      mes: index + 1,
      cantidadSemanas: 4,
    }));

    const validation = validateAnnualCommercialWeeksConfiguration(
      2026,
      monthsConfig,
    );

    expect(validation).toMatchObject({
      valida: false,
      semanasConfiguradas: 48,
      semanasRequeridas: 52,
    });
  });
});
