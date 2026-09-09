jest.mock("./ghlAdvisorAvailabilityService", () => ({
  resolveConfiguredAdvisors: jest.fn(async (configuredUsers) => ({
    active: configuredUsers,
    paused: [],
    invalid: [],
  })),
  isGhlUserActiveToday: jest.fn(async () => true),
}));

const service = require("./ghlOpportunityDistributionService");
const ghl = require("./ghlService");
const { sequelize } = require("../config/db");
const Ejecucion = require("../models/GhlRepartoEjecucion");
const Detalle = require("../models/GhlRepartoEjecucionDetalle");
const advisorAvailability = require("./ghlAdvisorAvailabilityService");

const makeRun = (overrides = {}) => {
  const run = {
    id: 10, configuracionId: 3, estado: "running", heartbeatAt: new Date(), startedAt: new Date(),
    totalEncontradas: 2, totalElegibles: 2, totalAsignadas: 0, totalErrores: 0,
    update: jest.fn(async (values) => { Object.assign(run, values); return run; }),
    reload: jest.fn(async () => run),
    ...overrides,
  };
  return run;
};
const transactionMock = () => jest.spyOn(sequelize, "transaction").mockImplementation(async (callback) => callback({ LOCK: { UPDATE: "UPDATE" } }));

afterEach(() => jest.restoreAllMocks());

describe("control de ejecuciones GHL", () => {
  const mockExecuteInfrastructure = (run, opportunityResult) => {
    const connection = { query: jest.fn().mockResolvedValueOnce({ rows: [{ locked: true }] }).mockResolvedValueOnce({ rows: [{ pg_advisory_unlock: true }] }) };
    jest.spyOn(sequelize.connectionManager, "getConnection").mockResolvedValue(connection);
    jest.spyOn(sequelize.connectionManager, "releaseConnection").mockResolvedValue();
    jest.spyOn(Ejecucion, "findOne").mockResolvedValue(null);
    jest.spyOn(Ejecucion, "create").mockResolvedValue(run);
    jest.spyOn(Ejecucion, "findByPk").mockResolvedValue({ id: run.id, estado: "running" });
    jest.spyOn(Detalle, "findAll").mockImplementation(async (options) => options.attributes ? [] : []);
    jest.spyOn(Detalle, "bulkCreate").mockResolvedValue([]);
    jest.spyOn(ghl, "getGhlConfig").mockReturnValue({ locationId: "l" });
    jest.spyOn(ghl, "createGhlClient").mockReturnValue({ request: jest.fn() });
    jest.spyOn(ghl, "fetchAllAssignableUsers").mockResolvedValue([{ id: "u1" }, { id: "u2" }]);
    jest.spyOn(ghl, "fetchOpportunitiesByStatus")[opportunityResult instanceof Error ? "mockRejectedValue" : "mockResolvedValue"](opportunityResult);
    return connection;
  };

  test("cero oportunidades finaliza rapidamente como completed", async () => {
    const run = makeRun({ totalEncontradas: 0, totalElegibles: 0 });
    mockExecuteInfrastructure(run, []);
    const config = { id: 3, pipelineId: "p", stageId: "s", modo: "all", pipelineNombre: "P", stageNombre: "S", usuariosGhl: [{ id: "u1" }, { id: "u2" }], indiceSiguienteUsuario: 0, update: jest.fn() };
    const result = await service.execute(config);
    expect(result.estado).toBe("completed");
    expect(result.finishedAt).toEqual(expect.any(Date));
    expect(Detalle.bulkCreate).not.toHaveBeenCalled();
  });

  test("todos pausados finaliza omitida y conserva oportunidades pendientes", async () => {
    const run = makeRun({ totalEncontradas: 0, totalElegibles: 0 });
    mockExecuteInfrastructure(run, [{ id: "o1", pipelineId: "p", pipelineStageId: "s" }]);
    advisorAvailability.resolveConfiguredAdvisors.mockResolvedValueOnce({
      active: [],
      paused: [{ id: "u1" }, { id: "u2" }],
      invalid: [],
    });
    const config = { id: 3, pipelineId: "p", stageId: "s", modo: "unassigned", pipelineNombre: "P", stageNombre: "S", usuariosGhl: [{ id: "u1" }, { id: "u2" }], indiceSiguienteUsuario: 0, update: jest.fn() };

    const result = await service.execute(config);

    expect(result.estado).toBe("skipped");
    expect(result.errorGeneral).toContain("pendientes sin propietario");
    expect(Detalle.bulkCreate).not.toHaveBeenCalled();
  });

  test("error antes de encontrar oportunidades finaliza failed y libera el lock", async () => {
    const run = makeRun({ totalEncontradas: 0, totalElegibles: 0 });
    const connection = mockExecuteInfrastructure(run, Object.assign(new Error("timeout"), { code: "GHL_CONNECTION_ERROR" }));
    const config = { id: 3, pipelineId: "p", stageId: "s", modo: "all", pipelineNombre: "P", stageNombre: "S", usuariosGhl: [{ id: "u1" }, { id: "u2" }], indiceSiguienteUsuario: 0, update: jest.fn() };
    await expect(service.execute(config)).rejects.toMatchObject({ code: "GHL_CONNECTION_ERROR" });
    expect(run).toMatchObject({ estado: "failed", finishedAt: expect.any(Date) });
    expect(connection.query).toHaveBeenLastCalledWith("SELECT pg_advisory_unlock(hashtext($1))", ["ghl-reparto:3"]);
  });

  test("solicita pausa con transicion atomica", async () => {
    const run = makeRun(); transactionMock(); jest.spyOn(Ejecucion, "findByPk").mockResolvedValue(run);
    await service.requestPause(run.id);
    expect(run.update).toHaveBeenCalledWith(expect.objectContaining({ estado: "pause_requested", pauseRequestedAt: expect.any(Date) }), expect.anything());
  });

  test("rechaza doble solicitud de pausa con 409", async () => {
    const run = makeRun({ estado: "pause_requested" }); transactionMock(); jest.spyOn(Ejecucion, "findByPk").mockResolvedValue(run);
    await expect(service.requestPause(run.id)).rejects.toMatchObject({ statusCode: 409, code: "EXECUTION_ALREADY_PAUSED" });
  });

  test("pausa antes de iniciar la primera oportunidad", async () => {
    const run = makeRun({ estado: "pause_requested" });
    jest.spyOn(Ejecucion, "findByPk").mockResolvedValue(run);
    jest.spyOn(Detalle, "findAll").mockResolvedValue([]);
    const client = { request: jest.fn() };
    await service.processPlan(run, {}, client);
    expect(run.estado).toBe("paused");
    expect(client.request).not.toHaveBeenCalled();
    expect(run.update).toHaveBeenCalledWith(expect.objectContaining({ pausedAt: expect.any(Date) }));
  });

  test("pausa durante el reparto y no inicia otra oportunidad", async () => {
    const run = makeRun();
    const first = { id: 1, opportunityId: "o1", newAssignedTo: "u1", attemptCount: 0, update: jest.fn(async (values) => Object.assign(first, values)) };
    const second = { id: 2, opportunityId: "o2", newAssignedTo: "u2", attemptCount: 0, update: jest.fn() };
    let stateChecks = 0;
    jest.spyOn(Ejecucion, "findByPk").mockImplementation(async () => ({ id: run.id, estado: ++stateChecks >= 4 ? "pause_requested" : "running" }));
    jest.spyOn(Detalle, "findAll").mockImplementation(async (options) => options.attributes ? [{ estado: first.estado || "assigned" }, { estado: "pending" }] : [first, second]);
    jest.spyOn(ghl, "requestGhl").mockResolvedValueOnce({ opportunity: { id: "o1", pipelineId: "p", pipelineStageId: "s" } }).mockResolvedValueOnce({});
    await service.processPlan(run, { pipelineId: "p", stageId: "s", modo: "all" }, {});
    expect(run.estado).toBe("paused");
    expect(second.update).not.toHaveBeenCalled();
    expect(ghl.requestGhl).toHaveBeenCalledTimes(2);
  });

  test("reanudar selecciona solamente pendientes y errores reintentables", async () => {
    const run = makeRun(); jest.spyOn(Ejecucion, "findByPk").mockResolvedValue({ estado: "running" });
    const find = jest.spyOn(Detalle, "findAll").mockResolvedValueOnce([]).mockResolvedValue([]);
    await service.processPlan(run, {}, {});
    expect(find.mock.calls[0][0].where).toEqual(expect.objectContaining({ ejecucionId: run.id, [require("sequelize").Op.or]: expect.any(Array) }));
  });

  test("reconcilia propietario planeado sin repetir escritura", async () => {
    const run = makeRun();
    const detail = { opportunityId: "o1", newAssignedTo: "u1", previousAssignedTo: null, attemptCount: 0, update: jest.fn(async (values) => Object.assign(detail, values)) };
    jest.spyOn(Ejecucion, "findByPk").mockResolvedValue({ estado: "running" });
    jest.spyOn(Detalle, "findAll").mockResolvedValue([{ estado: "assigned" }]);
    jest.spyOn(ghl, "requestGhl").mockResolvedValue({ opportunity: { assignedTo: "u1", pipelineId: "p", pipelineStageId: "s" } });
    await service.processOneDetail(run, { pipelineId: "p", stageId: "s", modo: "all" }, detail, {});
    expect(detail.estado).toBe("assigned");
    expect(ghl.requestGhl).toHaveBeenCalledTimes(1);
  });

  test("cancela una ejecucion activa solicitando detencion segura", async () => {
    const run = makeRun(); transactionMock(); jest.spyOn(Ejecucion, "findByPk").mockResolvedValue(run);
    await service.requestCancel(run.id);
    expect(run.update).toHaveBeenCalledWith(expect.objectContaining({ estado: "cancel_requested" }), expect.anything());
  });

  test("cancela una ejecucion pausada sin revertir detalles asignados", async () => {
    const run = makeRun({ estado: "paused" });
    const connection = { query: jest.fn().mockResolvedValueOnce({ rows: [{ locked: true }] }).mockResolvedValueOnce({ rows: [{ pg_advisory_unlock: true }] }) };
    jest.spyOn(sequelize.connectionManager, "getConnection").mockResolvedValue(connection);
    jest.spyOn(sequelize.connectionManager, "releaseConnection").mockResolvedValue();
    transactionMock();
    jest.spyOn(Ejecucion, "findByPk").mockResolvedValue(run);
    jest.spyOn(Detalle, "update").mockResolvedValue([1]);
    jest.spyOn(Detalle, "findAll").mockResolvedValue([{ estado: "assigned" }, { estado: "cancelled" }]);
    await service.requestCancel(run.id);
    expect(run.estado).toBe("cancelled");
    expect(Detalle.update).toHaveBeenCalledWith(expect.objectContaining({ estado: "cancelled" }), expect.objectContaining({ where: expect.anything() }));
    expect(run.update).not.toHaveBeenCalledWith(expect.objectContaining({ totalAsignadas: 0 }));
  });

  test("rechaza doble cancelacion", async () => {
    jest.spyOn(Ejecucion, "findByPk").mockResolvedValue(makeRun({ estado: "cancel_requested" }));
    await expect(service.requestCancel(10)).rejects.toMatchObject({ statusCode: 409, code: "EXECUTION_CANCEL_REQUESTED" });
  });

  test("dos intentos simultaneos de reanudacion no obtienen el mismo lock", async () => {
    const firstConnection = { query: jest.fn().mockResolvedValue({ rows: [{ locked: true }] }) };
    const secondConnection = { query: jest.fn().mockResolvedValue({ rows: [{ locked: false }] }) };
    jest.spyOn(sequelize.connectionManager, "getConnection").mockResolvedValueOnce(firstConnection).mockResolvedValueOnce(secondConnection);
    jest.spyOn(sequelize.connectionManager, "releaseConnection").mockResolvedValue();
    expect(await service.acquireLock(3)).toBe(firstConnection);
    expect(await service.acquireLock(3)).toBeNull();
    await service.releaseLock(firstConnection, 3);
  });

  test("no considera huerfana una ejecucion con heartbeat saludable", () => {
    expect(service.heartbeatExpired(makeRun(), Date.now())).toBe(false);
  });

  test("detecta heartbeat vencido de una ejecucion activa", () => {
    const old = new Date(Date.now() - service.STALE_AFTER_MS - 1000);
    expect(service.heartbeatExpired(makeRun({ heartbeatAt: old }), Date.now())).toBe(true);
  });

  test("rechaza finalizacion forzada de una ejecucion saludable", async () => {
    jest.spyOn(Ejecucion, "findByPk").mockResolvedValue(makeRun());
    await expect(service.forceFinishStale(10)).rejects.toMatchObject({ statusCode: 409, code: "EXECUTION_NOT_STALE" });
  });

  test("actualiza heartbeat y contadores derivados de detalles", async () => {
    const run = makeRun(); jest.spyOn(Detalle, "findAll").mockResolvedValue([{ estado: "assigned" }, { estado: "skipped" }]);
    await service.refreshCounters(run);
    expect(run.update).toHaveBeenCalledWith(expect.objectContaining({ heartbeatAt: expect.any(Date), processedCount: 2, totalAsignadas: 1 }));
  });

  test("un timeout individual queda como error reintentable", async () => {
    const run = makeRun();
    const detail = { opportunityId: "o1", newAssignedTo: "u1", attemptCount: 0, update: jest.fn(async (values) => Object.assign(detail, values)) };
    jest.spyOn(Ejecucion, "findByPk").mockResolvedValue({ estado: "running" });
    jest.spyOn(Detalle, "findAll").mockResolvedValue([{ estado: "error" }]);
    jest.spyOn(ghl, "requestGhl").mockRejectedValue(Object.assign(new Error("timeout"), { code: "GHL_CONNECTION_ERROR" }));
    await service.processOneDetail(run, {}, detail, {});
    expect(detail).toMatchObject({ estado: "error", retryable: true, errorCode: "GHL_CONNECTION_ERROR" });
  });

  test("un asesor pausado durante la ejecucion se omite antes de asignar", async () => {
    const run = makeRun();
    const detail = { opportunityId: "o1", newAssignedTo: "u1", attemptCount: 0, update: jest.fn(async (values) => Object.assign(detail, values)) };
    jest.spyOn(Ejecucion, "findByPk").mockResolvedValue({ estado: "running" });
    jest.spyOn(Detalle, "findAll").mockResolvedValue([{ estado: "skipped" }]);
    jest.spyOn(ghl, "requestGhl").mockResolvedValue({ opportunity: { id: "o1", pipelineId: "p", pipelineStageId: "s" } });
    advisorAvailability.isGhlUserActiveToday.mockResolvedValueOnce(false);

    await service.processOneDetail(run, { pipelineId: "p", stageId: "s", modo: "unassigned" }, detail, {});

    expect(detail).toMatchObject({ estado: "skipped", errorCode: "ADVISOR_PAUSED" });
    expect(ghl.requestGhl).toHaveBeenCalledTimes(1);
  });
});
