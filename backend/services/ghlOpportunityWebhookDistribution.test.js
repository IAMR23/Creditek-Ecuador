jest.mock("./ghlAdvisorAvailabilityService", () => ({
  resolveActiveAdvisors: jest.fn(),
  isGhlUserActiveToday: jest.fn(async () => true),
}));

const service = require("./ghlOpportunityDistributionService");
const ghl = require("./ghlService");
const advisorAvailability = require("./ghlAdvisorAvailabilityService");
const realtimeReviewCoordinator = require("./ghlRealtimeReviewCoordinator");
const { sequelize } = require("../config/db");
const TiempoRealAsignacion = require("../models/GhlRepartoTiempoRealAsignacion");

const opportunity = (overrides = {}) => ({
  id: "opp-1",
  contactId: "contact-1",
  pipelineId: "pipeline-1",
  pipelineStageId: "whatsapp",
  status: "open",
  ...overrides,
});

const pipeline = {
  id: "pipeline-1",
  name: "Ventas",
  stages: [
    { id: "whatsapp", name: "WhatsApp" },
    { id: "facebook", name: "Facebook" },
    { id: "gestion", name: "Gestion" },
  ],
};

function mockBase({ active = [{ id: "u1" }], open = [], locks = [true] } = {}) {
  const client = { request: jest.fn() };
  const connections = locks.map((locked) => ({
    query: jest.fn()
      .mockResolvedValueOnce({ rows: [{ locked }] })
      .mockResolvedValue({ rows: [{ pg_advisory_unlock: true }] }),
  }));
  let connectionIndex = 0;
  jest.spyOn(ghl, "getGhlConfig").mockReturnValue({ locationId: "location-1" });
  jest.spyOn(realtimeReviewCoordinator, "getRetryState").mockResolvedValue({ suspended: false });
  jest.spyOn(realtimeReviewCoordinator, "recordFailure").mockResolvedValue({});
  jest.spyOn(realtimeReviewCoordinator, "clearFailures").mockResolvedValue();
  jest.spyOn(ghl, "createGhlClient").mockReturnValue(client);
  jest.spyOn(ghl, "fetchPipelines").mockResolvedValue([pipeline]);
  jest.spyOn(ghl, "fetchAllAssignableUsers").mockResolvedValue(active);
  jest.spyOn(ghl, "fetchOpportunitiesByStatus").mockResolvedValue(open);
  jest.spyOn(TiempoRealAsignacion, "create").mockResolvedValue({});
  advisorAvailability.resolveActiveAdvisors.mockResolvedValue({
    active,
    paused: [],
    invalid: [],
  });
  advisorAvailability.isGhlUserActiveToday.mockResolvedValue(true);
  jest.spyOn(sequelize.connectionManager, "getConnection").mockImplementation(async () =>
    connections[Math.min(connectionIndex++, connections.length - 1)]);
  jest.spyOn(sequelize.connectionManager, "releaseConnection").mockResolvedValue();
  return { client, connections };
}

const putCalls = () => ghl.requestGhl.mock.calls.filter(([, options]) => options.method === "PUT");

describe("reparto GHL de tiempo real", () => {
  beforeEach(() => {
    delete process.env.GHL_REPARTO_MAX_PENDIENTES_POR_ASESOR;
    delete process.env.GHL_REPARTO_MAX_EXECUTION_MS;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    delete process.env.GHL_REPARTO_MAX_PENDIENTES_POR_ASESOR;
    delete process.env.GHL_REPARTO_MAX_EXECUTION_MS;
  });

  test("un solo asesor en Play recibe una oportunidad sin configuracion programada", async () => {
    mockBase({ active: [{ id: "u1" }], open: [opportunity()] });
    jest.spyOn(ghl, "requestGhl")
      .mockResolvedValueOnce({ opportunity: opportunity() })
      .mockResolvedValueOnce({ opportunity: opportunity() })
      .mockResolvedValueOnce({ ok: true });

    const result = await service.executeWebhookOpportunity({ opportunityId: "opp-1" });

    expect(result).toMatchObject({ code: "ASSIGNED", assigned: true, advisorId: "u1" });
    expect(putCalls()).toHaveLength(1);
    expect(TiempoRealAsignacion.create).toHaveBeenCalledWith(expect.objectContaining({
      opportunityId: "opp-1",
      ghlUserId: "u1",
      pipelineId: "pipeline-1",
      stageId: "whatsapp",
      trigger: "webhook",
    }));
  });

  test("sin asesores en Play la oportunidad permanece sin propietario", async () => {
    mockBase({ active: [], open: [opportunity()] });
    advisorAvailability.resolveActiveAdvisors.mockResolvedValue({ active: [], paused: [], invalid: [] });
    jest.spyOn(ghl, "requestGhl").mockResolvedValue({ opportunity: opportunity() });

    const result = await service.executeWebhookOpportunity({ opportunityId: "opp-1" });

    expect(result).toMatchObject({ code: "NO_ACTIVE_ADVISORS", assigned: false });
    expect(putCalls()).toHaveLength(0);
    expect(ghl.fetchPipelines).not.toHaveBeenCalled();
    expect(ghl.fetchOpportunitiesByStatus).not.toHaveBeenCalled();
    expect(ghl.requestGhl).not.toHaveBeenCalled();
  });

  test("el respaldo finaliza antes de consultar o paginar oportunidades cuando no hay asesores", async () => {
    mockBase({ active: [], open: [opportunity()] });
    advisorAvailability.resolveActiveAdvisors.mockResolvedValue({ active: [], paused: [], invalid: [] });

    const result = await service.executeRealtimeQueue({ trigger: "scheduler" });

    expect(result).toMatchObject({ code: "NO_ACTIVE_ADVISORS", assigned: false, pendingCount: null });
    expect(ghl.fetchPipelines).not.toHaveBeenCalled();
    expect(ghl.fetchOpportunitiesByStatus).not.toHaveBeenCalled();
  });

  test("una suspension persistida evita nuevos intentos GHL sin afectar el backend", async () => {
    mockBase({ active: [{ id: "u1" }], open: [opportunity()] });
    realtimeReviewCoordinator.getRetryState.mockResolvedValue({
      suspended: true,
      retryAfter: "2026-09-17T12:30:00.000Z",
      lastFailureCode: "GHL_CONNECTION_ERROR",
    });

    const result = await service.executeRealtimeQueue({ trigger: "scheduler" });

    expect(result).toMatchObject({
      code: "GHL_REPARTO_SUSPENDED",
      retryAfter: "2026-09-17T12:30:00.000Z",
    });
    expect(ghl.fetchAllAssignableUsers).not.toHaveBeenCalled();
    expect(sequelize.connectionManager.getConnection).not.toHaveBeenCalled();
  });

  test("la cola elige oportunidades abiertas de WhatsApp y Facebook", async () => {
    const whatsapp = opportunity({ id: "wa-1", pipelineStageId: "whatsapp" });
    const facebook = opportunity({ id: "fb-1", pipelineStageId: "facebook" });
    mockBase({ active: [{ id: "u1" }], open: [whatsapp, facebook] });
    jest.spyOn(ghl, "requestGhl").mockImplementation(async (_client, options) => {
      if (options.method === "GET") {
        const id = decodeURIComponent(options.url.split("/").at(-1));
        return { opportunity: id === "wa-1" ? whatsapp : facebook };
      }
      return { ok: true };
    });

    const result = await service.executeRealtimeQueue({ trigger: "play" });

    expect(result).toMatchObject({ code: "QUEUE_PROCESSED", assignedCount: 2 });
    expect(putCalls()).toHaveLength(2);
  });

  test("consulta cada etapa admitida, deduplica y conserva la carga completa", async () => {
    const { client } = mockBase({ active: [{ id: "u1" }, { id: "u2" }] });
    const duplicate = opportunity({ id: "shared", pipelineStageId: "whatsapp", assignedTo: "u1" });
    ghl.fetchOpportunitiesByStatus
      .mockResolvedValueOnce([
        duplicate,
        opportunity({ id: "wa-u1", pipelineStageId: "whatsapp", assignedTo: "u1" }),
      ])
      .mockResolvedValueOnce([
        duplicate,
        opportunity({ id: "fb-u2", pipelineStageId: "facebook", assignedTo: "u2" }),
      ]);
    const context = await service.getRealtimePipelineContext(client, { locationId: "location-1" });

    const found = await service.fetchRealtimeOpenOpportunities(
      client,
      { locationId: "location-1" },
      context,
    );
    const loads = service.currentLoadsByAdvisor(found, [{ id: "u1" }, { id: "u2" }]);

    expect(found.map((item) => item.id).sort()).toEqual(["fb-u2", "shared", "wa-u1"]);
    expect(loads.get("u1")).toBe(2);
    expect(loads.get("u2")).toBe(1);
    expect(ghl.fetchOpportunitiesByStatus).toHaveBeenNthCalledWith(
      1,
      client,
      expect.objectContaining({ pipelineId: "pipeline-1", pipelineStageId: "whatsapp" }),
      "open",
      {},
      expect.any(Object),
    );
    expect(ghl.fetchOpportunitiesByStatus).toHaveBeenNthCalledWith(
      2,
      client,
      expect.objectContaining({ pipelineId: "pipeline-1", pipelineStageId: "facebook" }),
      "open",
      {},
      expect.any(Object),
    );
  });

  test("usa el pipeline configurado aunque GHL devuelva otro primero", async () => {
    const { client } = mockBase();
    ghl.fetchPipelines.mockResolvedValueOnce([
      { id: "otro-pipeline", stages: [{ id: "otra", name: "WhatsApp" }] },
      pipeline,
    ]);

    const context = await service.getRealtimePipelineContext(client, {
      locationId: "location-1",
      pipelineId: "pipeline-1",
    });

    expect(context.pipelineId).toBe("pipeline-1");
    expect([...context.stageIds].sort()).toEqual(["facebook", "whatsapp"]);
  });

  test("rechaza un GHL_PIPELINE_ID configurado que no pertenece a la ubicacion", async () => {
    const { client } = mockBase();

    await expect(service.getRealtimePipelineContext(client, {
      locationId: "location-1",
      pipelineId: "pipeline-inexistente",
    })).rejects.toMatchObject({
      code: "GHL_CONFIGURED_PIPELINE_NOT_FOUND",
      statusCode: 502,
    });
  });

  test("una oportunidad en otra etapa no se modifica", async () => {
    const gestion = opportunity({ pipelineStageId: "gestion" });
    mockBase({ active: [{ id: "u1" }], open: [gestion] });
    jest.spyOn(ghl, "requestGhl").mockResolvedValue({ opportunity: gestion });

    const result = await service.executeWebhookOpportunity({ opportunityId: "opp-1" });

    expect(result).toMatchObject({ code: "STAGE_NOT_ELIGIBLE", assigned: false });
    expect(putCalls()).toHaveLength(0);
  });

  test("la capacidad suma la carga abierta de WhatsApp y Facebook", async () => {
    const assignedWhatsapp = Array.from({ length: 6 }, (_, index) =>
      opportunity({ id: `wa-${index}`, pipelineStageId: "whatsapp", assignedTo: "u1" }));
    const assignedFacebook = Array.from({ length: 4 }, (_, index) =>
      opportunity({ id: `fb-${index}`, pipelineStageId: "facebook", assignedTo: "u1" }));
    mockBase({
      active: [{ id: "u1" }],
      open: [opportunity(), ...assignedWhatsapp, ...assignedFacebook],
    });
    jest.spyOn(ghl, "requestGhl").mockResolvedValue({ opportunity: opportunity() });

    const result = await service.executeWebhookOpportunity({ opportunityId: "opp-1" });

    expect(result).toMatchObject({ code: "NO_CAPACITY", assigned: false });
    expect(putCalls()).toHaveLength(0);
  });

  test("Pausa posterior a la planificacion impide una nueva asignacion", async () => {
    mockBase({ active: [{ id: "u1" }], open: [opportunity()] });
    advisorAvailability.isGhlUserActiveToday.mockResolvedValue(false);
    jest.spyOn(ghl, "requestGhl").mockResolvedValue({ opportunity: opportunity() });

    const result = await service.executeWebhookOpportunity({ opportunityId: "opp-1" });

    expect(result).toMatchObject({ code: "ADVISOR_PAUSED", assigned: false });
    expect(putCalls()).toHaveLength(0);
  });

  test("una oportunidad con propietario nunca se reasigna", async () => {
    const assigned = opportunity({ assignedTo: "manual" });
    mockBase({ active: [{ id: "u1" }], open: [assigned] });
    jest.spyOn(ghl, "requestGhl").mockResolvedValue({ opportunity: assigned });

    const result = await service.executeWebhookOpportunity({ opportunityId: "opp-1" });

    expect(result).toMatchObject({ code: "ALREADY_ASSIGNED", assigned: false });
    expect(putCalls()).toHaveLength(0);
  });

  test("si GHL aplico el PUT pero se perdio la respuesta, la recuperacion no sobrescribe", async () => {
    const staleUnassigned = opportunity();
    let remoteOwner = null;
    mockBase({ active: [{ id: "u1" }], open: [staleUnassigned], locks: [true, true] });
    jest.spyOn(ghl, "requestGhl").mockImplementation(async (_client, options) => {
      if (options.method === "GET") {
        return { opportunity: opportunity({ assignedTo: remoteOwner }) };
      }
      remoteOwner = options.data.assignedTo;
      throw Object.assign(new Error("respuesta perdida despues de aplicar"), {
        code: "GHL_CONNECTION_ERROR",
      });
    });

    const first = await service.executeRealtimeQueue({ trigger: "scheduler" });
    expect(first).toMatchObject({ code: "QUEUE_FAILED", assignedCount: 0 });
    expect(remoteOwner).toBe("u1");
    expect(putCalls()).toHaveLength(1);

    const recovered = await service.executeRealtimeQueue({ trigger: "scheduler" });

    expect(recovered).toMatchObject({ code: "QUEUE_PROCESSED", assignedCount: 0 });
    expect(remoteOwner).toBe("u1");
    expect(putCalls()).toHaveLength(1);
    expect(TiempoRealAsignacion.create).not.toHaveBeenCalled();
  });

  test("dos asesores en Play reciben segun la menor carga combinada", async () => {
    const pending = opportunity();
    mockBase({
      active: [{ id: "u1" }, { id: "u2" }],
      open: [
        pending,
        opportunity({ id: "u1-wa", assignedTo: "u1", pipelineStageId: "whatsapp" }),
        opportunity({ id: "u1-fb", assignedTo: "u1", pipelineStageId: "facebook" }),
      ],
    });
    jest.spyOn(ghl, "requestGhl")
      .mockResolvedValueOnce({ opportunity: pending })
      .mockResolvedValueOnce({ opportunity: pending })
      .mockResolvedValueOnce({ ok: true });

    const result = await service.executeWebhookOpportunity({ opportunityId: "opp-1" });

    expect(result).toMatchObject({ code: "ASSIGNED", advisorId: "u2" });
  });

  test("dos acciones simultaneas no asignan dos veces la misma oportunidad", async () => {
    mockBase({ active: [{ id: "u1" }], open: [opportunity()], locks: [true, false] });
    jest.spyOn(ghl, "requestGhl")
      .mockResolvedValueOnce({ opportunity: opportunity() })
      .mockResolvedValueOnce({ opportunity: opportunity() })
      .mockResolvedValueOnce({ ok: true });

    const results = await Promise.all([
      service.executeWebhookOpportunity({ opportunityId: "opp-1" }),
      service.executeWebhookOpportunity({ opportunityId: "opp-1" }),
    ]);

    expect(results.map((result) => result.code).sort()).toEqual([
      "ASSIGNED",
      "PREVIOUS_EXECUTION_RUNNING",
    ]);
    expect(putCalls()).toHaveLength(1);
  });

  test("un 429 lento se cancela y tras el timeout no continua asignando", async () => {
    jest.useFakeTimers();
    const log = jest.spyOn(console, "log").mockImplementation(() => {});
    process.env.GHL_REPARTO_MAX_EXECUTION_MS = "10000";
    mockBase({
      active: [{ id: "u1" }],
      open: [opportunity(), opportunity({ id: "opp-2" })],
      locks: [true, true],
    });
    const rateLimited = Object.assign(new Error("rate limited"), {
      upstreamStatus: 429,
      retryAfterMs: 60_000,
      code: "GHL_RATE_LIMITED",
    });
    jest.spyOn(ghl, "requestGhl").mockRejectedValue(rateLimited);

    const execution = service.executeRealtimeQueue({ trigger: "play" });
    while (ghl.requestGhl.mock.calls.length === 0) await Promise.resolve();
    const timedOut = expect(execution).rejects.toMatchObject({ code: "GHL_EXECUTION_TIMEOUT" });
    await jest.advanceTimersByTimeAsync(10_000);
    await timedOut;
    await jest.advanceTimersByTimeAsync(60_000);

    expect(putCalls()).toHaveLength(0);
    expect(TiempoRealAsignacion.create).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith("[GHL] RESUMEN_REPARTO", expect.objectContaining({
      resultado: "FAILED",
      faseDelFallo: "ASSIGNMENTS",
      codigo: "GHL_EXECUTION_TIMEOUT",
    }));

    ghl.requestGhl.mockImplementation(async (_client, options) => (
      options.method === "GET"
        ? { opportunity: options.url.endsWith("opp-2") ? opportunity({ id: "opp-2" }) : opportunity() }
        : { ok: true }
    ));
    const next = await service.executeRealtimeQueue({ trigger: "play" });
    expect(next).toMatchObject({ code: "QUEUE_PROCESSED", assignedCount: 2 });
    expect(putCalls()).toHaveLength(2);
    jest.useRealTimers();
  });

  test("busca la oportunidad por contactId sin exigir pipelineId ni stageId", async () => {
    mockBase({ active: [{ id: "u1" }], open: [opportunity()] });
    jest.spyOn(ghl, "fetchOpportunitiesByContact").mockResolvedValue([opportunity()]);
    jest.spyOn(ghl, "requestGhl")
      .mockResolvedValueOnce({ opportunity: opportunity() })
      .mockResolvedValueOnce({ ok: true });

    const result = await service.executeWebhookOpportunity({ contactId: "contact-1" });

    expect(result).toMatchObject({ code: "ASSIGNED", assigned: true });
    expect(ghl.fetchOpportunitiesByContact).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      "contact-1",
    );
  });
});
