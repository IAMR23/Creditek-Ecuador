jest.mock("../models/GhlRepartoConfiguracion", () => ({
  findAll: jest.fn(async () => []),
}));

jest.mock("node-cron", () => ({
  schedule: jest.fn(() => ({ stop: jest.fn() })),
}));

jest.mock("./ghlOpportunityDistributionService", () => ({
  TIME_ZONE: "America/Guayaquil",
  recoverStaleRuns: jest.fn(async () => {}),
  recoverPendingRealtimeQueueReviews: jest.fn(async () => ({ pendingCount: 0 })),
  executeRealtimeQueue: jest.fn(async () => ({
    code: "NO_PENDING_OPPORTUNITIES",
    assignedCount: 0,
  })),
  localScheduleParts: jest.fn(() => ({ day: 1, time: "00:01", window: "2026-09-14T00:01" })),
  execute: jest.fn(),
  sanitize: jest.fn((value) => String(value)),
}));

const service = require("./ghlOpportunityDistributionService");
const scheduler = require("./ghlOpportunityDistributionScheduler");
const Configuracion = require("../models/GhlRepartoConfiguracion");

describe("respaldo de la cola GHL de tiempo real", () => {
  afterEach(() => jest.clearAllMocks());

  test("revisa la cola cada minuto sin depender de una hora configurada", async () => {
    await scheduler.tick(new Date("2026-09-14T05:01:00.000Z"));

    expect(service.executeRealtimeQueue).toHaveBeenCalledWith({ trigger: "scheduler" });
    expect(service.recoverPendingRealtimeQueueReviews).toHaveBeenCalledTimes(1);
  });

  test("al iniciar recupera revisiones pendientes persistidas", async () => {
    await scheduler.start();

    expect(service.recoverStaleRuns).toHaveBeenCalled();
    expect(service.recoverPendingRealtimeQueueReviews).toHaveBeenCalledTimes(1);
  });

  test("si otra ejecucion sigue activa omite el resto del ciclo", async () => {
    service.executeRealtimeQueue.mockResolvedValueOnce({
      code: "PREVIOUS_EXECUTION_RUNNING",
      repartoOmitido: true,
    });

    await scheduler.tick(new Date("2026-09-14T05:01:00.000Z"));

    expect(Configuracion.findAll).not.toHaveBeenCalled();
    expect(service.execute).not.toHaveBeenCalled();
  });

  test("si GHL esta en backoff no ejecuta repartos programados en ese ciclo", async () => {
    service.executeRealtimeQueue.mockResolvedValueOnce({
      code: "GHL_REPARTO_SUSPENDED",
      retryAfter: "2026-09-17T12:30:00.000Z",
    });

    await scheduler.tick(new Date("2026-09-14T05:01:00.000Z"));

    expect(Configuracion.findAll).not.toHaveBeenCalled();
    expect(service.execute).not.toHaveBeenCalled();
  });

  test("detiene las configuraciones restantes si una pierde el mutex global", async () => {
    Configuracion.findAll.mockResolvedValueOnce([
      { id: 1, activo: true, modo: "unassigned", hora: "00:01", intervaloMinutos: 1, diasSemana: [1] },
      { id: 2, activo: true, modo: "unassigned", hora: "00:01", intervaloMinutos: 1, diasSemana: [1] },
    ]);
    service.execute.mockResolvedValueOnce({ code: "PREVIOUS_EXECUTION_RUNNING", repartoOmitido: true });

    await scheduler.tick(new Date("2026-09-14T05:01:00.000Z"));

    expect(service.execute).toHaveBeenCalledTimes(1);
  });
});
