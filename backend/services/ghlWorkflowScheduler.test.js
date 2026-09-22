const cron = require("node-cron");
const Programacion = require("../models/GhlWorkflowProgramacion");
const executionService = require("./ghlWorkflowExecutionService");
const scheduler = require("./ghlWorkflowScheduler");

afterEach(() => jest.restoreAllMocks());

describe("scheduler independiente de workflows GHL", () => {
  test("recupera ejecuciones y revisa solamente programaciones activas", async () => {
    const now = new Date("2026-09-21T15:00:00.000Z");
    const rows = [{ id: 1 }, { id: 2 }];
    const recover = jest.spyOn(executionService, "recoverStaleRuns").mockResolvedValue(0);
    jest.spyOn(Programacion, "findAll").mockResolvedValue(rows);
    const execute = jest.spyOn(executionService, "executeScheduled").mockResolvedValue({ skipped: false });

    await scheduler.tick(now);

    expect(recover).toHaveBeenCalledWith(now);
    expect(Programacion.findAll).toHaveBeenCalledWith({ where: { activo: true }, order: [["id", "ASC"]] });
    expect(execute.mock.calls.map((call) => call[0].id)).toEqual([1, 2]);
  });

  test("un error de una programacion no impide revisar la siguiente", async () => {
    jest.spyOn(executionService, "recoverStaleRuns").mockResolvedValue(0);
    jest.spyOn(Programacion, "findAll").mockResolvedValue([{ id: 1 }, { id: 2 }]);
    const execute = jest.spyOn(executionService, "executeScheduled")
      .mockRejectedValueOnce(Object.assign(new Error("fallo controlado"), { code: "TEST_ERROR" }))
      .mockResolvedValueOnce({ skipped: false });
    jest.spyOn(console, "error").mockImplementation(() => {});

    await scheduler.tick(new Date("2026-09-21T15:00:00.000Z"));

    expect(execute).toHaveBeenCalledTimes(2);
  });

  test("se registra cada minuto con zona America/Guayaquil", async () => {
    const task = { stop: jest.fn() };
    jest.spyOn(executionService, "recoverStaleRuns").mockResolvedValue(0);
    const schedule = jest.spyOn(cron, "schedule").mockReturnValue(task);
    jest.spyOn(console, "log").mockImplementation(() => {});

    await expect(scheduler.start()).resolves.toBe(task);
    expect(schedule).toHaveBeenCalledWith("* * * * *", expect.any(Function), {
      timezone: "America/Guayaquil",
    });
  });
});
