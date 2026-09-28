jest.mock("node-cron", () => ({ schedule: jest.fn() }));
jest.mock("./ghlBroadcastQueueService", () => ({
  processDueExecutions: jest.fn(),
  recoverStaleExecutions: jest.fn(),
}));

const cron = require("node-cron");
const queueService = require("./ghlBroadcastQueueService");
const scheduler = require("./ghlBroadcastScheduler");

describe("ghlBroadcastScheduler", () => {
  test("procesa lotes vencidos en cada tick", async () => {
    const now = new Date("2026-09-28T15:00:00.000Z");
    queueService.processDueExecutions.mockResolvedValue([{ id: 1 }]);
    await expect(scheduler.tick(now)).resolves.toEqual([{ id: 1 }]);
    expect(queueService.processDueExecutions).toHaveBeenCalledWith(now);
  });

  test("recupera pendientes y se registra cada minuto", async () => {
    queueService.recoverStaleExecutions.mockResolvedValue(0);
    queueService.processDueExecutions.mockResolvedValue([]);
    const task = { stop: jest.fn() };
    cron.schedule.mockReturnValue(task);
    jest.spyOn(console, "log").mockImplementation(() => {});

    await expect(scheduler.start()).resolves.toBe(task);
    expect(cron.schedule).toHaveBeenCalledWith("* * * * *", expect.any(Function), {
      timezone: "America/Guayaquil",
    });
  });
});
