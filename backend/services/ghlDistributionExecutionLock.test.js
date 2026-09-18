const { sequelize } = require("../config/db");
const lockService = require("./ghlDistributionExecutionLock");

describe("mutex global del reparto GHL por locationId", () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    lockService.activeByLocation.clear();
    delete process.env.GHL_REPARTO_LONG_RUNNING_MS;
    delete process.env.GHL_REPARTO_LONG_RUNNING_INTERVAL_MS;
    delete process.env.GHL_REPARTO_CONNECTION_ACQUIRE_MS;
    delete process.env.GHL_REPARTO_LOCK_QUERY_MS;
    delete process.env.GHL_REPARTO_CANCELLATION_GRACE_MS;
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
      faseActual: "ADVISORY_LOCK",
      paginasConsultadas: 0,
      oportunidadesExaminadas: 0,
      asignacionesRealizadas: 0,
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

    const execution = lockService.runWithTimeout(handle, () => new Promise((_, reject) => {
      handle.controller.signal.addEventListener("abort", () => reject(handle.controller.signal.reason), {
        once: true,
      });
    }), 50);
    const timedOut = expect(execution).rejects.toMatchObject({ code: "GHL_EXECUTION_TIMEOUT" });
    await jest.advanceTimersByTimeAsync(50);
    await timedOut;
    expect(handle.controller.signal.aborted).toBe(true);
    await lockService.release(handle);
    jest.useRealTimers();
  });

  test("conserva el lock hasta que la operacion cancelada deja de trabajar", async () => {
    jest.useFakeTimers();
    const connection = {
      query: jest.fn()
        .mockResolvedValueOnce({ rows: [{ locked: true }] })
        .mockResolvedValue({ rows: [{ pg_advisory_unlock: true }] }),
    };
    jest.spyOn(sequelize.connectionManager, "getConnection").mockResolvedValue(connection);
    jest.spyOn(sequelize.connectionManager, "releaseConnection").mockResolvedValue();
    const handle = await lockService.acquire("location-1");
    let settleOperation;
    const operation = new Promise((resolve) => { settleOperation = resolve; });
    let completed = false;
    const execution = lockService.runWithTimeout(handle, async () => {
      await operation;
      lockService.throwIfAborted(handle);
      completed = true;
    }, 50);
    const timedOut = expect(execution).rejects.toMatchObject({ code: "GHL_EXECUTION_TIMEOUT" });

    await jest.advanceTimersByTimeAsync(50);
    expect(lockService.activeByLocation.has("location-1")).toBe(true);
    expect(completed).toBe(false);
    settleOperation();
    await timedOut;
    expect(completed).toBe(false);
    await lockService.release(handle);
  });

  test("un error libera recursos y permite adquirir un reparto posterior", async () => {
    const connections = [0, 1].map(() => ({
      query: jest.fn()
        .mockResolvedValueOnce({ rows: [{ locked: true }] })
        .mockResolvedValue({ rows: [{ pg_advisory_unlock: true }] }),
    }));
    jest.spyOn(sequelize.connectionManager, "getConnection")
      .mockResolvedValueOnce(connections[0])
      .mockResolvedValueOnce(connections[1]);
    jest.spyOn(sequelize.connectionManager, "releaseConnection").mockResolvedValue();

    const first = await lockService.acquire("location-1");
    await expect(lockService.runWithTimeout(first, async () => {
      throw new Error("fallo esperado");
    }, 100)).rejects.toThrow("fallo esperado");
    await lockService.release(first);

    const second = await lockService.acquire("location-1");
    expect(second).not.toBeNull();
    await lockService.release(second);
  });

  test("el aviso prolongado incluye fase, duracion y progreso con frecuencia limitada", async () => {
    jest.useFakeTimers();
    process.env.GHL_REPARTO_LONG_RUNNING_MS = "1000";
    process.env.GHL_REPARTO_LONG_RUNNING_INTERVAL_MS = "2000";
    const connection = {
      query: jest.fn()
        .mockResolvedValueOnce({ rows: [{ locked: true }] })
        .mockResolvedValue({ rows: [{ pg_advisory_unlock: true }] }),
    };
    jest.spyOn(sequelize.connectionManager, "getConnection").mockResolvedValue(connection);
    jest.spyOn(sequelize.connectionManager, "releaseConnection").mockResolvedValue();
    const warning = jest.spyOn(console, "warn").mockImplementation(() => {});
    const handle = await lockService.acquire("location-1");
    lockService.updateProgress(handle, {
      phase: "QUEUE_DATA",
      pagesConsulted: 3,
      opportunitiesExamined: 250,
      assignmentsCompleted: 1,
    });
    let finish;
    const execution = lockService.runWithTimeout(handle, () => new Promise((resolve) => {
      finish = resolve;
    }), 10_000);

    await jest.advanceTimersByTimeAsync(1_000);
    expect(warning).toHaveBeenCalledTimes(1);
    expect(warning).toHaveBeenCalledWith("[GHL] REPARTO_PROLONGADO", expect.objectContaining({
      faseActual: "QUEUE_DATA",
      duracionMs: expect.any(Number),
      paginasConsultadas: 3,
      oportunidadesExaminadas: 250,
      asignacionesRealizadas: 1,
    }));
    await jest.advanceTimersByTimeAsync(1_000);
    expect(warning).toHaveBeenCalledTimes(1);
    finish();
    await execution;
    await lockService.release(handle);
  });

  test("una espera agotada de conexion no filtra el recurso que llega tarde", async () => {
    jest.useFakeTimers();
    process.env.GHL_REPARTO_CONNECTION_ACQUIRE_MS = "100";
    let resolveConnection;
    const lateConnection = { query: jest.fn() };
    jest.spyOn(sequelize.connectionManager, "getConnection").mockReturnValue(
      new Promise((resolve) => { resolveConnection = resolve; }),
    );
    const release = jest.spyOn(sequelize.connectionManager, "releaseConnection").mockResolvedValue();

    const acquisition = lockService.acquire("location-1");
    const timedOut = expect(acquisition).rejects.toMatchObject({ code: "GHL_DB_CONNECTION_TIMEOUT" });
    await jest.advanceTimersByTimeAsync(100);
    await timedOut;
    expect(lockService.activeByLocation.has("location-1")).toBe(false);

    resolveConnection(lateConnection);
    await jest.advanceTimersByTimeAsync(0);
    expect(release).toHaveBeenCalledWith(lateConnection);
    expect(lateConnection.query).not.toHaveBeenCalled();
  });

  test("destruye la conexion si la consulta del advisory lock no responde", async () => {
    jest.useFakeTimers();
    process.env.GHL_REPARTO_LOCK_QUERY_MS = "100";
    const connection = { query: jest.fn(() => new Promise(() => {})) };
    jest.spyOn(sequelize.connectionManager, "getConnection").mockResolvedValue(connection);
    const destroy = jest.spyOn(sequelize.connectionManager, "destroyConnection").mockResolvedValue();

    const acquisition = lockService.acquire("location-1");
    const timedOut = expect(acquisition).rejects.toMatchObject({ code: "GHL_LOCK_QUERY_TIMEOUT" });
    await jest.advanceTimersByTimeAsync(100);
    await timedOut;

    expect(destroy).toHaveBeenCalledWith(connection);
    expect(lockService.activeByLocation.has("location-1")).toBe(false);
  });

  test("una operacion que ignora cancelacion queda en cuarentena sin reiniciar el backend", async () => {
    jest.useFakeTimers();
    const connection = {
      query: jest.fn()
        .mockResolvedValueOnce({ rows: [{ locked: true }] })
        .mockResolvedValue({ rows: [{ pg_advisory_unlock: true }] }),
    };
    jest.spyOn(sequelize.connectionManager, "getConnection").mockResolvedValue(connection);
    jest.spyOn(sequelize.connectionManager, "releaseConnection").mockResolvedValue();
    const handle = await lockService.acquire("location-1");
    let settleOperation;
    const onUnresponsive = jest.fn().mockResolvedValue();
    const exit = jest.spyOn(process, "exit").mockImplementation(() => {});
    const execution = lockService.runWithTimeout(
      handle,
      () => new Promise((resolve) => { settleOperation = resolve; }),
      50,
      { cancellationGrace: 100, onUnresponsive },
    );
    const failedSafe = expect(execution).rejects.toMatchObject({
      code: "GHL_CANCELLATION_UNRESPONSIVE",
    });

    await jest.advanceTimersByTimeAsync(150);
    expect(onUnresponsive).toHaveBeenCalledWith(expect.objectContaining({
      code: "GHL_CANCELLATION_UNRESPONSIVE",
    }));
    expect(exit).not.toHaveBeenCalled();
    expect(lockService.activeByLocation.has("location-1")).toBe(true);

    settleOperation();
    await failedSafe;
    await lockService.release(handle);
  });
});
