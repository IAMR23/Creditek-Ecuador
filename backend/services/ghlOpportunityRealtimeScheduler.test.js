jest.mock("../models/GhlRepartoConfiguracion", () => ({
  findAll: jest.fn(async () => []),
}));

jest.mock("./ghlOpportunityDistributionService", () => ({
  TIME_ZONE: "America/Guayaquil",
  recoverStaleRuns: jest.fn(async () => {}),
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

describe("respaldo de la cola GHL de tiempo real", () => {
  afterEach(() => jest.clearAllMocks());

  test("revisa la cola cada minuto sin depender de una hora configurada", async () => {
    await scheduler.tick(new Date("2026-09-14T05:01:00.000Z"));

    expect(service.executeRealtimeQueue).toHaveBeenCalledWith({ trigger: "scheduler" });
  });
});
