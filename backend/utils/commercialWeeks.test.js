const {
  getCommercialWeekKey,
  getCommercialWeeksByMonth,
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
});
