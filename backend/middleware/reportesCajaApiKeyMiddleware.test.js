const {
  requireReportesCajaCelularesApiKey,
  requireReportesCajaTelevisionesApiKey,
} = require("./reportesCajaApiKeyMiddleware");

const crearRespuesta = () => {
  const res = {
    status: jest.fn(() => res),
    json: jest.fn(() => res),
  };
  return res;
};

describe("API keys de reportes caja", () => {
  const apiKeyRve = "rve_test_12345678901234567890123456789012";

  beforeEach(() => {
    process.env.API_KEY_RVE = apiKeyRve;
  });

  afterEach(() => {
    delete process.env.API_KEY_RVE;
    jest.restoreAllMocks();
  });

  test("acepta API_KEY_RVE en la API de celulares", () => {
    const req = { get: jest.fn(() => apiKeyRve) };
    const next = jest.fn();

    requireReportesCajaCelularesApiKey(req, crearRespuesta(), next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.integration).toEqual({
      type: "api_key",
      name: "reportes-caja-celulares-import",
    });
  });

  test("la misma API_KEY_RVE abre la API de televisiones", () => {
    const req = { get: jest.fn(() => apiKeyRve) };
    const next = jest.fn();

    requireReportesCajaTelevisionesApiKey(
      req,
      crearRespuesta(),
      next,
    );

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.integration).toEqual({
      type: "api_key",
      name: "reportes-caja-televisiones-import",
    });
  });

  test("rechaza una solicitud de televisiones sin API key", () => {
    const res = crearRespuesta();

    requireReportesCajaTelevisionesApiKey(
      { get: jest.fn(() => undefined) },
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "REPORTES_CAJA_TELEVISIONES_API_KEY_MISSING",
      }),
    );
  });

  test("falla cerrado si la clave de celulares no esta configurada", () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    process.env.API_KEY_RVE = "corta";
    const res = crearRespuesta();

    requireReportesCajaCelularesApiKey(
      { get: jest.fn(() => "corta") },
      res,
      jest.fn(),
    );

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "REPORTES_CAJA_CELULARES_API_KEY_NOT_CONFIGURED",
      }),
    );
  });
});
