jest.mock("../models/GhlRepartoRevisionPendiente", () => ({
  findByPk: jest.fn(),
  findAll: jest.fn(),
  update: jest.fn(),
  create: jest.fn(),
}));

jest.mock("./ghlDistributionExecutionLock", () => ({
  acquireConnection: jest.fn(),
  connectionAcquireMs: jest.fn(() => 10_000),
  queryConnection: jest.fn((connection, text, values) => connection.query(text, values)),
  maxExecutionMs: jest.fn(() => 10_000),
}));

const { sequelize } = require("../config/db");
const RevisionPendiente = require("../models/GhlRepartoRevisionPendiente");
const distributionLock = require("./ghlDistributionExecutionLock");
const coordinator = require("./ghlRealtimeReviewCoordinator");

describe("coordinacion de revisiones posteriores al Play", () => {
  let state;
  let connection;

  beforeEach(() => {
    jest.useFakeTimers();
    coordinator.localWorkers.clear();
    state = {
      locationId: "location-1",
      requestedVersion: 0,
      processedVersion: 0,
      lastTrigger: "play",
      failureCount: 0,
      retryAfter: null,
      lastFailureCode: null,
    };
    connection = {
      query: jest.fn()
        .mockResolvedValue({ rows: [{ locked: true }] }),
    };
    distributionLock.acquireConnection.mockResolvedValue(connection);
    jest.spyOn(sequelize.connectionManager, "releaseConnection").mockResolvedValue();
    jest.spyOn(sequelize, "transaction").mockImplementation(async (handler) => handler({
      LOCK: { UPDATE: "UPDATE" },
    }));
    jest.spyOn(sequelize, "query").mockImplementation(async (_sql, options) => {
      state.requestedVersion += 1;
      state.lastTrigger = options.bind.trigger;
      return [[{ requestedVersion: state.requestedVersion }], {}];
    });
    RevisionPendiente.findByPk.mockImplementation(async () => ({ ...state }));
    RevisionPendiente.findAll.mockImplementation(async () => [{ ...state }]);
    RevisionPendiente.update.mockImplementation(async (values) => {
      Object.assign(state, values);
      return [1];
    });
    RevisionPendiente.create.mockImplementation(async (values) => {
      Object.assign(state, values);
      return { ...state };
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    jest.clearAllMocks();
    coordinator.localWorkers.clear();
  });

  test("un asesor que activa Play durante un reparto participa en la revision posterior", async () => {
    const activeAdvisors = ["u1"];
    const executeQueue = jest.fn()
      .mockResolvedValueOnce({ code: "PREVIOUS_EXECUTION_RUNNING" })
      .mockImplementationOnce(async () => ({
        code: "QUEUE_PROCESSED",
        advisors: [...activeAdvisors],
      }));

    await coordinator.requestReview({
      locationId: "location-1",
      trigger: "play",
      executeQueue,
    });
    await jest.advanceTimersByTimeAsync(0);
    expect(executeQueue).toHaveBeenCalledTimes(1);

    activeAdvisors.push("u2");
    await jest.advanceTimersByTimeAsync(coordinator.DEFAULT_BUSY_RETRY_MS);
    await coordinator.localWorkers.get("location-1");

    expect(executeQueue).toHaveBeenCalledTimes(2);
    expect(await executeQueue.mock.results[1].value).toMatchObject({ advisors: ["u1", "u2"] });
    expect(state.processedVersion).toBe(state.requestedVersion);
  });

  test("varios Play concurrentes se agrupan en una sola ejecucion", async () => {
    let releaseQueue;
    const executeQueue = jest.fn(() => new Promise((resolve) => { releaseQueue = resolve; }));

    const requests = await Promise.all([
      coordinator.requestReview({ locationId: "location-1", trigger: "play", executeQueue }),
      coordinator.requestReview({ locationId: "location-1", trigger: "play", executeQueue }),
      coordinator.requestReview({ locationId: "location-1", trigger: "play", executeQueue }),
    ]);
    await jest.advanceTimersByTimeAsync(0);

    expect(requests.map((item) => item.requestedVersion)).toEqual([1, 2, 3]);
    expect(executeQueue).toHaveBeenCalledTimes(1);
    releaseQueue({ code: "QUEUE_PROCESSED" });
    await coordinator.localWorkers.get("location-1");

    expect(executeQueue).toHaveBeenCalledTimes(1);
    expect(state.processedVersion).toBe(3);
  });

  test("dos replicas no drenan la revision en simultaneo", async () => {
    state.requestedVersion = 1;
    const leaderConnection = {
      query: jest.fn().mockResolvedValue({ rows: [{ locked: true }] }),
    };
    const followerConnection = {
      query: jest.fn().mockResolvedValue({ rows: [{ locked: false }] }),
    };
    distributionLock.acquireConnection
      .mockResolvedValueOnce(leaderConnection)
      .mockResolvedValueOnce(followerConnection);
    let finishLeader;
    const executeLeader = jest.fn(() => new Promise((resolve) => { finishLeader = resolve; }));
    const executeFollower = jest.fn();

    const leader = coordinator.drain("location-1", executeLeader);
    await jest.advanceTimersByTimeAsync(0);
    const follower = await coordinator.drain("location-1", executeFollower);

    expect(follower).toMatchObject({ code: "REVIEW_GROUPED_OTHER_PROCESS", pending: true });
    expect(executeLeader).toHaveBeenCalledTimes(1);
    expect(executeFollower).not.toHaveBeenCalled();
    finishLeader({ code: "QUEUE_PROCESSED" });
    await leader;
  });

  test("recupera automaticamente una revision pendiente despues del reinicio", async () => {
    state.requestedVersion = 4;
    state.processedVersion = 3;
    const executeQueue = jest.fn().mockResolvedValue({ code: "QUEUE_PROCESSED" });

    const recovered = await coordinator.recoverPendingReviews({ executeQueue });
    await jest.advanceTimersByTimeAsync(0);
    const worker = coordinator.localWorkers.get("location-1");
    if (worker) await worker;

    expect(recovered).toEqual({ pendingCount: 1 });
    expect(executeQueue).toHaveBeenCalledTimes(1);
    expect(state.processedVersion).toBe(4);
  });

  test("un error conserva la revision pendiente sin crear un ciclo local continuo", async () => {
    state.requestedVersion = 1;
    const error = Object.assign(new Error("GHL temporal"), { code: "GHL_CONNECTION_ERROR" });
    const executeQueue = jest.fn().mockRejectedValue(error);
    jest.spyOn(console, "error").mockImplementation(() => {});

    const result = await coordinator.drain("location-1", executeQueue);
    await jest.advanceTimersByTimeAsync(60_000);

    expect(result).toMatchObject({ code: "REVIEW_FAILED_PENDING", pending: true });
    expect(state.processedVersion).toBe(0);
    expect(executeQueue).toHaveBeenCalledTimes(1);
    expect(coordinator.localWorkers.size).toBe(0);
  });

  test("persiste backoff exponencial y lo conserva tras reiniciar el coordinador", async () => {
    const now = new Date("2026-09-17T12:00:00.000Z");
    const first = await coordinator.recordFailure("location-1", "GHL_CONNECTION_ERROR", now);
    const second = await coordinator.recordFailure(
      "location-1",
      "GHL_CONNECTION_ERROR",
      new Date(now.getTime() + 1_000),
    );

    expect(first.failureCount).toBe(1);
    expect(first.retryAfter).toBe("2026-09-17T12:01:00.000Z");
    expect(second.failureCount).toBe(2);
    expect(second.retryAfter).toBe("2026-09-17T12:02:01.000Z");

    coordinator.localWorkers.clear();
    await expect(coordinator.getRetryState(
      "location-1",
      new Date("2026-09-17T12:01:30.000Z"),
    )).resolves.toMatchObject({
      suspended: true,
      failureCount: 2,
      lastFailureCode: "GHL_CONNECTION_ERROR",
    });
  });

  test("una revision suspendida permanece pendiente sin reintentos locales", async () => {
    state.requestedVersion = 1;
    const executeQueue = jest.fn().mockResolvedValue({
      code: "GHL_REPARTO_SUSPENDED",
      retryAfter: "2026-09-17T12:01:00.000Z",
    });

    const result = await coordinator.drain("location-1", executeQueue);
    await jest.advanceTimersByTimeAsync(60_000);

    expect(result).toMatchObject({ code: "REVIEW_SUSPENDED", pending: true });
    expect(state.processedVersion).toBe(0);
    expect(executeQueue).toHaveBeenCalledTimes(1);
  });
});
