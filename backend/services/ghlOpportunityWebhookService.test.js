jest.mock("../models/GhlRepartoWebhookEvento", () => ({
  create: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
}));
jest.mock("./ghlOpportunityDistributionService", () => ({
  executeWebhookOpportunity: jest.fn(),
}));

const WebhookEvento = require("../models/GhlRepartoWebhookEvento");
const distribution = require("./ghlOpportunityDistributionService");
const service = require("./ghlOpportunityWebhookService");

describe("webhook de reparto GHL", () => {
  beforeEach(() => jest.clearAllMocks());

  test("valida el secreto con comparacion segura y rechaza ausentes o incorrectos", () => {
    expect(service.isValidWebhookSecret(null, "correcto")).toBe(false);
    expect(service.isValidWebhookSecret("incorrecto", "correcto")).toBe(false);
    expect(service.isValidWebhookSecret("correcto", "correcto")).toBe(true);
  });

  test("acepta campos estandar y personalizados anidados sin persistir el telefono", async () => {
    WebhookEvento.create.mockResolvedValue({ id: 7 });
    const schedule = jest.fn();
    const payload = {
      data: { opportunity: { id: "opp-1" }, contact: { id: "contact-1", phone: "+593999999999" } },
      customData: { location: { id: "loc-1" }, workflow: { id: "flow-1" }, source: "workflow" },
    };
    await service.enqueueWebhookEvent(payload, { "x-ghl-event-id": "event-1" }, schedule);
    expect(WebhookEvento.create).toHaveBeenCalledWith(expect.objectContaining({
      opportunityId: "opp-1", contactId: "contact-1", locationId: "loc-1", workflowId: "flow-1", source: "workflow",
    }));
    expect(WebhookEvento.create.mock.calls[0][0]).not.toHaveProperty("phone");
    expect(schedule).toHaveBeenCalledWith(7, expect.objectContaining({ phone: "+593999999999" }));
  });

  test("dos eventos simultaneos con el mismo identificador se programan una sola vez", async () => {
    WebhookEvento.create
      .mockResolvedValueOnce({ id: 8 })
      .mockRejectedValueOnce(Object.assign(new Error("duplicate"), { name: "SequelizeUniqueConstraintError" }));
    WebhookEvento.findOne.mockResolvedValue({ id: 8 });
    const schedule = jest.fn();
    const payload = { opportunityId: "opp-1" };
    const [first, second] = await Promise.all([
      service.enqueueWebhookEvent(payload, { "x-ghl-event-id": "same-event" }, schedule),
      service.enqueueWebhookEvent(payload, { "x-ghl-event-id": "same-event" }, schedule),
    ]);
    expect([first.duplicate, second.duplicate].sort()).toEqual([false, true]);
    expect(schedule).toHaveBeenCalledTimes(1);
    expect(WebhookEvento.create.mock.calls[0][0].idempotencyKey).toBe(WebhookEvento.create.mock.calls[1][0].idempotencyKey);
  });

  test("un evento ya reclamado no se procesa de nuevo", async () => {
    WebhookEvento.update.mockResolvedValue([0]);
    await expect(service.processWebhookEvent(9, { opportunityId: "opp-1" })).resolves.toMatchObject({ code: "DUPLICATE_OR_PROCESSING" });
    expect(distribution.executeWebhookOpportunity).not.toHaveBeenCalled();
  });

  test("oportunidad inexistente queda ignorada de forma controlada para el scheduler", async () => {
    WebhookEvento.update.mockResolvedValueOnce([1]).mockResolvedValueOnce([1]);
    distribution.executeWebhookOpportunity.mockResolvedValue({ code: "OPPORTUNITY_NOT_FOUND", assigned: false, deferredToScheduler: true });
    const result = await service.processWebhookEvent(10, { contactId: "contact-1" });
    expect(result.code).toBe("OPPORTUNITY_NOT_FOUND");
    expect(WebhookEvento.update).toHaveBeenLastCalledWith(expect.objectContaining({ estado: "ignored", resultCode: "OPPORTUNITY_NOT_FOUND" }), expect.anything());
  });

  test("falta de capacidad no se registra como error tecnico", async () => {
    WebhookEvento.update.mockResolvedValueOnce([1]).mockResolvedValueOnce([1]);
    distribution.executeWebhookOpportunity.mockResolvedValue({ code: "NO_CAPACITY", assigned: false, deferredToScheduler: true });
    await service.processWebhookEvent(11, { opportunityId: "opp-1" });
    expect(WebhookEvento.update).toHaveBeenLastCalledWith(expect.objectContaining({ estado: "ignored", resultCode: "NO_CAPACITY", lastError: null }), expect.anything());
  });

  test("los fallos no persisten telefonos, tokens ni secretos del mensaje", async () => {
    WebhookEvento.update.mockResolvedValueOnce([1]).mockResolvedValueOnce([1]);
    distribution.executeWebhookOpportunity.mockRejectedValue(Object.assign(new Error("phone +593999999999 token=secreto"), { code: "GHL_UPSTREAM_ERROR" }));
    await service.processWebhookEvent(12, { opportunityId: "opp-1" });
    const failure = WebhookEvento.update.mock.calls[1][0];
    expect(failure).toMatchObject({ estado: "failed", lastError: "GHL_UPSTREAM_ERROR" });
    expect(JSON.stringify(failure)).not.toMatch(/593999999999|secreto/);
  });
});
