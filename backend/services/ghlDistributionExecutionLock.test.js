const { sequelize } = require("../config/db");
const lockService = require("./ghlDistributionExecutionLock");

describe("mutex global del reparto GHL por locationId", () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    lockService.activeByLocation.clear();
  });

  test("omite una segunda ejecucion simultanea y registra solo los datos requeridos", async () => {
    const connection = {
      query: jest.fn()
        .mockResolvedValueOnce({ rows: [{ locked: true }] })
        .mockResolvedValueOnce({ rows: [{ pg_advisory_unlock: true }] }),
    };
    jest.spyOn(sequelize.connectionManager, "getConnection").mockResolvedValue(connection);
    jest.spyOn(sequelize.connectionManager, "releaseConnection").mockResolvedValue();
    const log = jest.spyOn(console, "log").mockImplementation(() => {});

    const first = await lockService.acquire("location-1");
    const second = await lockService.acquire("location-1");

    expect(second).toBeNull();
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith("[GHL] REPARTO_OMITIDO", {
      motivo: "PREVIOUS_EXECUTION_RUNNING",
      inicioEjecucionActual: first.startedAt.toISOString(),
      duracionActualMs: expect.any(Number),
    });
    await lockService.release(first);
  });

  test("libera el advisory lock aunque la ejecucion falle", async () => {
    const connection = {
      query: jest.fn()
        .mockResolvedValueOnce({ rows: [{ locked: true }] })
        .mockResolvedValueOnce({ rows: [{ pg_advisory_unlock: true }] }),
    };
    jest.spyOn(sequelize.connectionManager, "getConnection").mockResolvedValue(connection);
    jest.spyOn(sequelize.connectionManager, "releaseConnection").mockResolvedValue();
    const handle = await lockService.acquire("location-1");

    try {
      await lockService.runWithTimeout(handle, async () => {
        throw new Error("fallo controlado");
      });
    } catch (error) {
      expect(error.message).toBe("fallo controlado");
    } finally {
      await lockService.release(handle);
    }

    expect(connection.query).toHaveBeenLastCalledWith(
      "SELECT pg_advisory_unlock(hashtext($1))",
      ["ghl-reparto:location:location-1"],
    );
    expect(sequelize.connectionManager.releaseConnection).toHaveBeenCalledWith(connection);
    expect(lockService.activeByLocation.has("location-1")).toBe(false);
  });

  test("aborta una ejecucion que supera el tiempo maximo", async () => {
    jest.useFakeTimers();
    const connection = {
      query: jest.fn()
        .mockResolvedValueOnce({ rows: [{ locked: true }] })
        .mockResolvedValueOnce({ rows: [{ pg_advisory_unlock: true }] }),
    };
    jest.spyOn(sequelize.connectionManager, "getConnection").mockResolvedValue(connection);
    jest.spyOn(sequelize.connectionManager, "releaseConnection").mockResolvedValue();
    const handle = await lockService.acquire("location-1");

    const execution = lockService.runWithTimeout(handle, () => new Promise(() => {}), 50);
    const timedOut = expect(execution).rejects.toMatchObject({ code: "GHL_EXECUTION_TIMEOUT" });
    await jest.advanceTimersByTimeAsync(50);
    await timedOut;
    expect(handle.controller.signal.aborted).toBe(true);
    await lockService.release(handle);
    jest.useRealTimers();
  });
});
