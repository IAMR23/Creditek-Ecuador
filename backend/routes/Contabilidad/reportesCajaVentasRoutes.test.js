const fsp = require("fs/promises");
const express = require("express");
const request = require("supertest");

jest.mock("../../controllers/Contabilidad/reportesCajaVentasController", () => ({
  extraerCierreCajaConVentas: jest.fn((req, res) =>
    res.json({ ok: true, campos: Object.keys(req.files || {}) }),
  ),
  importarVentasApi: jest.fn((req, res) =>
    res.status(201).json({
      ok: true,
      tipo: req.reportesCajaApiTipo,
      campos: Object.keys(req.files || {}),
    }),
  ),
}));

const mockAuthenticate = jest.fn((req, _res, next) => {
  req.user = { id: 7 };
  next();
});
jest.mock("../../middleware/authMiddleware", () => ({
  authenticate: (...args) => mockAuthenticate(...args),
  requirePermission: (...allowed) => (req, res, next) =>
    allowed.includes(req.headers["x-test-permission"])
      ? next()
      : res.status(403).json({ message: "No autorizado" }),
}));

const controller = require("../../controllers/Contabilidad/reportesCajaVentasController");
const routes = require("./reportesCajaVentasRoutes");

const crearApp = () => {
  const app = express();
  app.use("/api/contabilidad/reportes-caja-ventas", routes);
  return app;
};

describe("rutas API de ventas para reportes caja", () => {
  const apiKeyRve = "rve_test_12345678901234567890123456789012";

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.API_KEY_RVE = apiKeyRve;
  });

  afterEach(async () => {
    const roots = [
      ...controller.importarVentasApi.mock.calls,
      ...controller.extraerCierreCajaConVentas.mock.calls,
    ]
      .map(([req]) => req.reportesCajaVentasTempRoot)
      .filter(Boolean);
    await Promise.all(
      roots.map((root) => fsp.rm(root, { recursive: true, force: true })),
    );
    jest.restoreAllMocks();
  });

  afterAll(() => {
    delete process.env.API_KEY_RVE;
  });

  test("recibe PDFs de celulares sin ejecutar autenticacion JWT", async () => {
    const response = await request(crearApp())
      .post("/api/contabilidad/reportes-caja-ventas/celulares/importar")
      .set("x-api-key", apiKeyRve)
      .attach("archivos", Buffer.from("pdf-celular"), "celular.pdf");

    expect(response.status).toBe(201);
    expect(response.body).toEqual(
      expect.objectContaining({
        ok: true,
        tipo: "CELULAR",
        campos: ["ventasCelular"],
      }),
    );
    expect(mockAuthenticate).not.toHaveBeenCalled();
    const req = controller.importarVentasApi.mock.calls[0][0];
    expect(req.files.ventasCelular).toHaveLength(1);
  });

  test("recibe PDFs de televisiones con su clave independiente", async () => {
    const response = await request(crearApp())
      .post("/api/contabilidad/reportes-caja-ventas/televisiones/importar")
      .set("x-api-key", apiKeyRve)
      .attach("archivo", Buffer.from("pdf-tv"), "television.pdf");

    expect(response.status).toBe(201);
    expect(response.body.tipo).toBe("TV");
    expect(response.body.campos).toEqual(["ventasTv"]);
    const req = controller.importarVentasApi.mock.calls[0][0];
    expect(req.files.ventasTv).toHaveLength(1);
  });

  test("rechaza una clave RVE incorrecta en televisiones", async () => {
    jest.spyOn(console, "warn").mockImplementation(() => {});
    const response = await request(crearApp())
      .post("/api/contabilidad/reportes-caja-ventas/televisiones/importar")
      .set("x-api-key", "rve_bad_12345678901234567890123456789012")
      .attach("archivo", Buffer.from("pdf-tv"), "television.pdf");

    expect(response.status).toBe(401);
    expect(response.body.code).toBe(
      "REPORTES_CAJA_TELEVISIONES_API_KEY_INVALID",
    );
    expect(controller.importarVentasApi).not.toHaveBeenCalled();
  });

  test("rechaza documentos que no sean PDF", async () => {
    const response = await request(crearApp())
      .post("/api/contabilidad/reportes-caja-ventas/celulares/importar")
      .set("x-api-key", apiKeyRve)
      .attach("archivo", Buffer.from("texto"), "celular.txt");

    expect(response.status).toBe(400);
    expect(response.body).toEqual(
      expect.objectContaining({
        ok: false,
        code: "ARCHIVO_INVALIDO",
      }),
    );
    expect(controller.importarVentasApi).not.toHaveBeenCalled();
  });

  test("conserva la carga manual protegida por JWT y permisos", async () => {
    const response = await request(crearApp())
      .post("/api/contabilidad/reportes-caja-ventas/extraer")
      .set("x-test-permission", "Contabilidad")
      .attach("ventasTv", Buffer.from("pdf-tv"), "television.pdf");

    expect(response.status).toBe(200);
    expect(mockAuthenticate).toHaveBeenCalled();
    expect(controller.extraerCierreCajaConVentas).toHaveBeenCalled();
  });
});
