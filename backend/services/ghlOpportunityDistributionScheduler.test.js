const Configuracion = require("../models/GhlRepartoConfiguracion");
const advisorAvailability = require("./ghlAdvisorAvailabilityService");
const distributionService = require("./ghlOpportunityDistributionService");
const { shouldRunConfiguration, tick } = require("./ghlOpportunityDistributionScheduler");

afterEach(() => jest.restoreAllMocks());

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

  test("cada ciclo aplica la pausa automatica antes de revisar la cola", async () => {
    const now = new Date("2026-09-21T23:00:00.000Z");
    const pause = jest.spyOn(advisorAvailability, "pauseAllActiveAdvisors")
      .mockResolvedValue({ executed: true, paused: 2 });
    const recoverStale = jest.spyOn(distributionService, "recoverStaleRuns")
      .mockResolvedValue();
    jest.spyOn(distributionService, "recoverPendingRealtimeQueueReviews").mockResolvedValue();
    const executeQueue = jest.spyOn(distributionService, "executeRealtimeQueue")
      .mockResolvedValue({ code: "NO_ACTIVE_ADVISORS" });
    jest.spyOn(Configuracion, "findAll").mockResolvedValue([]);

    await tick(now);

    expect(pause).toHaveBeenCalledWith({ now });
    expect(pause.mock.invocationCallOrder[0]).toBeLessThan(recoverStale.mock.invocationCallOrder[0]);
    expect(executeQueue).toHaveBeenCalledWith({ trigger: "scheduler" });
  });
});
