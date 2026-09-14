jest.mock("./ghlAdvisorAvailabilityService", () => ({
  resolveActiveAdvisors: jest.fn(),
  isGhlUserActiveToday: jest.fn(async () => true),
}));

const service = require("./ghlOpportunityDistributionService");
const ghl = require("./ghlService");
const advisorAvailability = require("./ghlAdvisorAvailabilityService");
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
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    delete process.env.GHL_REPARTO_MAX_PENDIENTES_POR_ASESOR;
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
      "DEFERRED_ACTIVE_EXECUTION",
    ]);
    expect(putCalls()).toHaveLength(1);
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
