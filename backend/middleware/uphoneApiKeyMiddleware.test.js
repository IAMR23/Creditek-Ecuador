const {
  requireUphoneApiKey,
} = require("./uphoneApiKeyMiddleware");

const createResponse = () => {
  const res = {
    status: jest.fn(() => res),
    json: jest.fn(() => res),
  };
  return res;
};

describe("requireUphoneApiKey", () => {
  const configuredKey = "uph_test_12345678901234567890123456789012";

  beforeEach(() => {
    process.env.API_KEY_RVE = configuredKey;
  });

  afterEach(() => {
    delete process.env.API_KEY_RVE;
  });

  test("permite la API key configurada", () => {
    const req = { get: jest.fn(() => configuredKey) };
    const res = createResponse();
    const next = jest.fn();

    requireUphoneApiKey(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.integration).toEqual({ type: "api_key", name: "uphone-import" });
  });

  test("rechaza una API key incorrecta", () => {
    const req = { get: jest.fn(() => "uph_bad_12345678901234567890123456789012") };
    const res = createResponse();

    requireUphoneApiKey(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "UPHONE_API_KEY_INVALID" }),
    );
  });

  test("falla cerrado cuando el servidor no tiene una clave segura", () => {
    process.env.API_KEY_RVE = "corta";
    const req = { get: jest.fn(() => "corta") };
    const res = createResponse();

    requireUphoneApiKey(req, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "UPHONE_API_KEY_NOT_CONFIGURED" }),
    );
  });
});
