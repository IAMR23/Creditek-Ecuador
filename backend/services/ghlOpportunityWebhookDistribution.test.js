jest.mock("./ghlAdvisorAvailabilityService", () => ({
  resolveConfiguredAdvisors: jest.fn(),
  isGhlUserActiveToday: jest.fn(async () => true),
}));

const service = require("./ghlOpportunityDistributionService");
const ghl = require("./ghlService");
const advisorAvailability = require("./ghlAdvisorAvailabilityService");
const Configuracion = require("../models/GhlRepartoConfiguracion");
const { sequelize } = require("../config/db");

const opportunity = (overrides = {}) => ({
  id: "opp-1", contactId: "contact-1", pipelineId: "pipeline-1", pipelineStageId: "stage-1", status: "open", ...overrides,
});

const configuration = (overrides = {}) => {
  const row = {
    id: 5, activo: true, modo: "unassigned", pipelineId: "pipeline-1", stageId: "stage-1",
    usuariosGhl: [{ id: "u1" }, { id: "u2" }], indiceSiguienteUsuario: 0, maxPendientesPorAsesor: 10,
    update: jest.fn(async (values) => { Object.assign(row, values); return row; }),
    ...overrides,
  };
  return row;
};

function mockBase(configRow, lockAvailable = true) {
  const client = { request: jest.fn() };
  const connection = { query: jest.fn()
    .mockResolvedValueOnce({ rows: [{ locked: lockAvailable }] })
    .mockResolvedValue({ rows: [{ pg_advisory_unlock: true }] }) };
  jest.spyOn(ghl, "getGhlConfig").mockReturnValue({ locationId: "location-1" });
  jest.spyOn(ghl, "createGhlClient").mockReturnValue(client);
  jest.spyOn(Configuracion, "findAll").mockResolvedValue([configRow]);
  jest.spyOn(Configuracion, "findByPk").mockResolvedValue(configRow);
  jest.spyOn(sequelize.connectionManager, "getConnection").mockResolvedValue(connection);
  jest.spyOn(sequelize.connectionManager, "releaseConnection").mockResolvedValue();
  jest.spyOn(ghl, "fetchAllAssignableUsers").mockResolvedValue([{ id: "u1" }, { id: "u2" }]);
  advisorAvailability.resolveConfiguredAdvisors.mockResolvedValue({ active: [{ id: "u1" }, { id: "u2" }], paused: [], invalid: [] });
  return { client, connection };
}

describe("asignacion disparada por webhook", () => {
  afterEach(() => jest.restoreAllMocks());

  test("asigna una oportunidad sin propietario respetando menor carga", async () => {
    const configRow = configuration();
    mockBase(configRow);
    jest.spyOn(ghl, "requestGhl")
      .mockResolvedValueOnce({ opportunity: opportunity() })
      .mockResolvedValueOnce({ opportunity: opportunity() })
      .mockResolvedValueOnce({ opportunity: opportunity() })
      .mockResolvedValueOnce({ ok: true });
    jest.spyOn(ghl, "fetchOpportunitiesByStatus").mockResolvedValue([
      opportunity(), opportunity({ id: "owned", assignedTo: "u1" }),
    ]);
    const result = await service.executeWebhookOpportunity({ opportunityId: "opp-1", locationId: "location-1" });
    expect(result).toMatchObject({ code: "ASSIGNED", assigned: true, advisorId: "u2" });
    expect(ghl.requestGhl).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ method: "PUT", data: { assignedTo: "u2" } }));
  });

  test("una oportunidad con propietario nunca se reasigna", async () => {
    const configRow = configuration();
    mockBase(configRow);
    jest.spyOn(ghl, "requestGhl").mockResolvedValue({ opportunity: opportunity({ assignedTo: "manual" }) });
    const result = await service.executeWebhookOpportunity({ opportunityId: "opp-1" });
    expect(result).toMatchObject({ code: "ALREADY_ASSIGNED", assigned: false });
    expect(ghl.requestGhl).toHaveBeenCalledTimes(1);
    expect(ghl.requestGhl).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ method: "PUT" }));
  });

  test("sin capacidad conserva la oportunidad para el scheduler", async () => {
    const configRow = configuration();
    mockBase(configRow);
    jest.spyOn(ghl, "requestGhl").mockResolvedValue({ opportunity: opportunity() });
    jest.spyOn(ghl, "fetchOpportunitiesByStatus").mockResolvedValue([
      opportunity(),
      ...Array.from({ length: 10 }, (_, index) => opportunity({ id: `u1-${index}`, assignedTo: "u1" })),
      ...Array.from({ length: 10 }, (_, index) => opportunity({ id: `u2-${index}`, assignedTo: "u2" })),
    ]);
    const result = await service.executeWebhookOpportunity({ opportunityId: "opp-1" });
    expect(result).toMatchObject({ code: "NO_CAPACITY", assigned: false, deferredToScheduler: true });
    expect(ghl.requestGhl).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ method: "PUT" }));
  });

  test("si otra ejecucion posee el bloqueo difiere al scheduler", async () => {
    const configRow = configuration();
    mockBase(configRow, false);
    jest.spyOn(ghl, "requestGhl").mockResolvedValue({ opportunity: opportunity() });
    const result = await service.executeWebhookOpportunity({ opportunityId: "opp-1" });
    expect(result).toMatchObject({ code: "DEFERRED_ACTIVE_EXECUTION", assigned: false, deferredToScheduler: true });
    expect(ghl.requestGhl).toHaveBeenCalledTimes(1);
  });

  test("oportunidad inexistente responde de forma controlada", async () => {
    const configRow = configuration();
    mockBase(configRow);
    jest.spyOn(ghl, "requestGhl").mockRejectedValue(Object.assign(new Error("not found"), { upstreamStatus: 404 }));
    await expect(service.executeWebhookOpportunity({ opportunityId: "missing" })).resolves.toMatchObject({
      code: "OPPORTUNITY_NOT_FOUND", assigned: false, deferredToScheduler: true,
    });
  });

  test("busca por contactId cuando no llega opportunityId", async () => {
    const configRow = configuration();
    mockBase(configRow);
    jest.spyOn(ghl, "fetchOpportunitiesByContact").mockResolvedValue([opportunity()]);
    jest.spyOn(ghl, "requestGhl")
      .mockResolvedValueOnce({ opportunity: opportunity() })
      .mockResolvedValueOnce({ opportunity: opportunity() })
      .mockResolvedValueOnce({ ok: true });
    jest.spyOn(ghl, "fetchOpportunitiesByStatus").mockResolvedValue([opportunity()]);
    const result = await service.executeWebhookOpportunity({ contactId: "contact-1" });
    expect(result).toMatchObject({ code: "ASSIGNED", assigned: true });
    expect(ghl.fetchOpportunitiesByContact).toHaveBeenCalledWith(expect.anything(), expect.anything(), "contact-1");
  });
});
