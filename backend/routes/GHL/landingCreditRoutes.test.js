jest.mock("../../services/landingCreditGhlService", () => ({
  submitLandingCreditApplication: jest.fn(),
}));

const express = require("express");
const request = require("supertest");
const {
  submitLandingCreditApplication,
} = require("../../services/landingCreditGhlService");
const {
  resetIdempotencyForTests,
} = require("../../controllers/GHL/landingCreditController");
const {
  resetPublicLandingRateLimitForTests,
} = require("../../middleware/publicLandingProtection");
const router = require("./landingCreditRoutes");

const app = express();
app.use(express.json());
app.use("/api/public/solicitudes-credito", router);

const body = {
  fullName: "Ana María López Pérez",
  cedula: "1710034065",
  phone: "0991234567",
  province: "Pichincha",
  productType: "Celular",
  website: "",
};

describe("POST /api/public/solicitudes-credito", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetIdempotencyForTests();
    resetPublicLandingRateLimitForTests();
  });

  test("es público y confirma solamente después del upsert", async () => {
    submitLandingCreditApplication.mockResolvedValue({ contactId: "contact-1", created: true });
    const response = await request(app)
      .post("/api/public/solicitudes-credito")
      .set("Idempotency-Key", "12345678-1234-1234-1234-123456789012")
      .send(body);

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ ok: true, message: "Tu solicitud fue enviada correctamente." });
    expect(submitLandingCreditApplication).toHaveBeenCalledWith(body);
  });

  test("deduplica envíos concurrentes con la misma clave", async () => {
    submitLandingCreditApplication.mockResolvedValue({ contactId: "contact-1", created: false });
    const send = () => request(app)
      .post("/api/public/solicitudes-credito")
      .set("Idempotency-Key", "same-request-1234567890")
      .send(body);

    const [first, second] = await Promise.all([send(), send()]);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(submitLandingCreditApplication).toHaveBeenCalledTimes(1);
  });

  test("permite reintentar con la misma clave después de un error", async () => {
    submitLandingCreditApplication
      .mockRejectedValueOnce(Object.assign(new Error("upstream"), {
        code: "GHL_CONNECTION_ERROR",
        statusCode: 502,
      }))
      .mockResolvedValueOnce({ contactId: "contact-1", created: false });
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    const send = () => request(app)
      .post("/api/public/solicitudes-credito")
      .set("Idempotency-Key", "retry-request-123456789")
      .send(body);

    expect((await send()).status).toBe(502);
    expect((await send()).status).toBe(200);
    expect(submitLandingCreditApplication).toHaveBeenCalledTimes(2);
    const logged = JSON.stringify(consoleError.mock.calls);
    expect(logged).not.toContain(body.cedula);
    expect(logged).not.toContain(body.phone);
    consoleError.mockRestore();
  });

  test("rechaza solicitudes sin clave de idempotencia", async () => {
    const response = await request(app).post("/api/public/solicitudes-credito").send(body);
    expect(response.status).toBe(400);
    expect(response.body.code).toBe("IDEMPOTENCY_KEY_REQUIRED");
    expect(submitLandingCreditApplication).not.toHaveBeenCalled();
  });

  test("devuelve errores de validación sin incluir datos sensibles", async () => {
    submitLandingCreditApplication.mockRejectedValue(Object.assign(new Error("invalid"), {
      code: "LANDING_CREDIT_VALIDATION_ERROR",
      statusCode: 422,
      validationErrors: { cedula: "Ingresa una cédula ecuatoriana válida" },
    }));
    const response = await request(app)
      .post("/api/public/solicitudes-credito")
      .set("Idempotency-Key", "invalid-request-123456789")
      .send(body);

    expect(response.status).toBe(422);
    expect(response.body.errors).toEqual({ cedula: "Ingresa una cédula ecuatoriana válida" });
    expect(JSON.stringify(response.body)).not.toContain(body.cedula);
    expect(JSON.stringify(response.body)).not.toContain(body.phone);
  });

  test("limita el abuso por cliente sin registrar datos personales", async () => {
    submitLandingCreditApplication.mockResolvedValue({ contactId: "contact-1", created: false });
    const responses = [];
    for (let index = 0; index < 11; index += 1) {
      responses.push(await request(app)
        .post("/api/public/solicitudes-credito")
        .set("Idempotency-Key", `rate-limit-request-${index}-123456`)
        .send(body));
    }

    expect(responses.slice(0, 10).every((response) => response.status === 200)).toBe(true);
    expect(responses[10].status).toBe(429);
    expect(responses[10].headers["retry-after"]).toBeDefined();
    expect(submitLandingCreditApplication).toHaveBeenCalledTimes(10);
  });
});
