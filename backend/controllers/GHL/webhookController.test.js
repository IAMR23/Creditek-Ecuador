jest.mock("../../services/ghlService", () => ({
  enviarAGHL: jest.fn(),
}));
jest.mock("../../services/ghlCedulaService", () => ({
  actualizarCedulaContactoDesdeMensaje: jest.fn(),
}));
jest.mock("../../services/ghlOpportunityWebhookService", () => ({
  logWebhookMessage: jest.fn((message) => message),
  isValidWebhookSecret: jest.fn(),
  logWebhookResult: jest.fn(),
  enqueueWebhookEvent: jest.fn(),
}));

const { enviarAGHL } = require("../../services/ghlService");
const {
  actualizarCedulaContactoDesdeMensaje,
} = require("../../services/ghlCedulaService");
const { recibirWebhookStevo } = require("./webhookController");

describe("recibirWebhookStevo con actualizacion de cedula", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    enviarAGHL.mockResolvedValue({ ok: true });
    actualizarCedulaContactoDesdeMensaje.mockResolvedValue({ status: "updated" });
  });

  test("un error actualizando la cedula no interrumpe el webhook ni el envio actual", async () => {
    actualizarCedulaContactoDesdeMensaje.mockRejectedValue(
      Object.assign(new Error("fallo GHL"), {
        code: "GHL_CONNECTION_ERROR",
        statusCode: 502,
      }),
    );
    const req = {
      body: {
        data: {
          Info: { IsFromMe: false },
          phone: "0991234567",
          conversation: "Mi cedula es 1710034065",
        },
      },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});

    await recibirWebhookStevo(req, res);

    expect(enviarAGHL).toHaveBeenCalledTimes(1);
    expect(actualizarCedulaContactoDesdeMensaje).toHaveBeenCalledWith({
      phone: "+593991234567",
      message: "Mi cedula es 1710034065",
      isFromMe: false,
      upsertResponse: { ok: true },
    });
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ ok: true, isFromMe: false }),
    );
    consoleError.mockRestore();
  });

  test("usa SenderAlt cuando Sender contiene un identificador LID", async () => {
    const req = {
      body: {
        data: {
          Info: {
            IsFromMe: false,
            Sender: "137009859449042@lid",
            SenderAlt: "593987981946@s.whatsapp.net",
            Chat: "137009859449042@lid",
          },
          conversation: "Hola",
        },
      },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    await recibirWebhookStevo(req, res);

    expect(enviarAGHL).toHaveBeenCalledWith(
      expect.objectContaining({ phone: "+593987981946" }),
    );
    expect(actualizarCedulaContactoDesdeMensaje).toHaveBeenCalledWith({
      phone: "+593987981946",
      message: "Hola",
      isFromMe: false,
      upsertResponse: { ok: true },
    });
  });

  test("no crea un contacto cuando el evento solo contiene un identificador LID", async () => {
    const req = {
      body: {
        data: {
          Info: {
            IsFromMe: false,
            Sender: "137009859449042@lid",
            Chat: "137009859449042@lid",
          },
          conversation: "Hola",
        },
      },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    const consoleWarn = jest.spyOn(console, "warn").mockImplementation(() => {});

    await recibirWebhookStevo(req, res);

    expect(enviarAGHL).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        phone: null,
        ghl: { skipped: true, reason: "INVALID_OR_MISSING_PHONE" },
      }),
    );
    consoleWarn.mockRestore();
  });
});
