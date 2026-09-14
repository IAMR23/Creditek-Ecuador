const { shouldRunConfiguration } = require("./ghlOpportunityDistributionScheduler");

describe("scheduler periodico de reparto GHL", () => {
  const base = {
    hora: "09:00",
    intervaloMinutos: 5,
    diasSemana: [1],
    modo: "unassigned",
  };

  test("consulta oportunidades sin propietario desde la hora configurada", () => {
    expect(shouldRunConfiguration(base, { day: 1, time: "09:00" })).toBe(true);
    expect(shouldRunConfiguration(base, { day: 1, time: "09:05" })).toBe(true);
    expect(shouldRunConfiguration(base, { day: 1, time: "09:03" })).toBe(false);
    expect(shouldRunConfiguration(base, { day: 1, time: "08:59" })).toBe(false);
  });

  test("redistribuir todas conserva una sola ejecucion programada", () => {
    const row = { ...base, modo: "all" };
    expect(shouldRunConfiguration(row, { day: 1, time: "09:00" })).toBe(true);
    expect(shouldRunConfiguration(row, { day: 1, time: "09:05" })).toBe(false);
  });

  test("refresco fuera de Gestion se ejecuta una vez a la hora elegida", () => {
    const row = { ...base, modo: "refresh_non_management" };
    expect(shouldRunConfiguration(row, { day: 1, time: "09:00" })).toBe(true);
    expect(shouldRunConfiguration(row, { day: 1, time: "09:05" })).toBe(false);
    expect(shouldRunConfiguration(row, { day: 2, time: "09:00" })).toBe(false);
  });
});
