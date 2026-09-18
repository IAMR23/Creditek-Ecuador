jest.mock("../services/ghlOpportunityWebhookService", () => ({
  isValidWebhookSecret: jest.fn(),
  enqueueWebhookEvent: jest.fn(),
  logWebhookResult: jest.fn(),
}));

const express = require("express");
const request = require("supertest");
const webhookService = require("../services/ghlOpportunityWebhookService");
const router = require("./webhookRoutes");

const app = express();
app.use(express.json());
app.use("/api/webhooks", router);

describe("POST /api/webhooks/ghl/reparto", () => {
  beforeEach(() => jest.clearAllMocks());

  test("no requiere JWT pero rechaza cuando falta el secreto", async () => {
    webhookService.isValidWebhookSecret.mockReturnValue(false);
    const response = await request(app).post("/api/webhooks/ghl/reparto").send({ opportunityId: "opp-1" });
    expect(response.status).toBe(401);
    expect(response.body.code).toBe("INVALID_WEBHOOK_SECRET");
    expect(webhookService.enqueueWebhookEvent).not.toHaveBeenCalled();
  });

  test("rechaza un secreto incorrecto", async () => {
    webhookService.isValidWebhookSecret.mockReturnValue(false);
    const response = await request(app).post("/api/webhooks/ghl/reparto").set("X-GHL-Webhook-Secret", "incorrecto").send({});
    expect(response.status).toBe(401);
    expect(webhookService.isValidWebhookSecret).toHaveBeenCalledWith("incorrecto");
  });

  test("acepta rapidamente un evento valido sin autenticacion RVE", async () => {
    webhookService.isValidWebhookSecret.mockReturnValue(true);
    webhookService.enqueueWebhookEvent.mockResolvedValue({ accepted: true, duplicate: false, eventId: 12 });
    const response = await request(app).post("/api/webhooks/ghl/reparto").set("X-GHL-Webhook-Secret", "correcto").send({ opportunityId: "opp-1" });
    expect(response.status).toBe(202);
    expect(webhookService.isValidWebhookSecret).toHaveBeenCalledWith("correcto");
    expect(response.body).toMatchObject({ ok: true, accepted: true, duplicate: false, eventId: 12 });
  });

  test("confirma un duplicado sin volver a programarlo", async () => {
    webhookService.isValidWebhookSecret.mockReturnValue(true);
    webhookService.enqueueWebhookEvent.mockResolvedValue({ accepted: true, duplicate: true, eventId: 12 });
    const response = await request(app).post("/api/webhooks/ghl/reparto").set("X-GHL-Webhook-Secret", "correcto").send({ opportunityId: "opp-1" });
    expect(response.status).toBe(200);
    expect(response.body.duplicate).toBe(true);
  });
});
