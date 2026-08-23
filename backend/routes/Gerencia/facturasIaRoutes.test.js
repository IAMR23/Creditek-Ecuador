const express = require("express");
const request = require("supertest");

jest.mock("../../services/facturasIaService", () => ({
  MAX_JSON_BYTES: 2 * 1024 * 1024,
  cargarArchivoJson: jest.fn(),
  listarResultados: jest.fn(),
  obtenerResultado: jest.fn(),
  seleccionarResultado: jest.fn(),
  listarParaExportar: jest.fn(),
}));
jest.mock("../../middleware/authMiddleware", () => ({
  authenticate: (req, _res, next) => {
    req.user = { id: 7, permisos: ["Gerencia"] };
    next();
  },
  requirePermission: () => (_req, _res, next) => next(),
}));

const service = require("../../services/facturasIaService");
const routes = require("./facturasIaRoutes");

const createApp = () => {
  const app = express();
  app.use(express.json());
  app.use("/api/gerencia/facturas-ia", routes);
  return app;
};

describe("rutas Facturas IA", () => {
  beforeEach(() => jest.clearAllMocks());

  test("lista resultados protegidos", async () => {
    service.listarResultados.mockResolvedValue({ ok: true, resultados: [] });
    const response = await request(createApp()).get("/api/gerencia/facturas-ia");
    expect(response.status).toBe(200);
    expect(response.body.resultados).toEqual([]);
  });

  test("carga un archivo JSON por multipart", async () => {
    service.cargarArchivoJson.mockResolvedValue([{ id: 1 }]);
    const response = await request(createApp())
      .post("/api/gerencia/facturas-ia")
      .field("grupoComparacion", "Factura 001")
      .attach("archivo", Buffer.from('{"total":10}', "utf8"), "factura.json");

    expect(response.status).toBe(201);
    expect(service.cargarArchivoJson).toHaveBeenCalledWith(
      expect.objectContaining({
        grupoComparacion: "Factura 001",
        usuarioId: 7,
        file: expect.objectContaining({ originalname: "factura.json" }),
      }),
    );
  });

  test("rechaza extensiones distintas de JSON", async () => {
    const response = await request(createApp())
      .post("/api/gerencia/facturas-ia")
      .attach("archivo", Buffer.from("dato", "utf8"), "factura.txt");
    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/\.json/i);
    expect(service.cargarArchivoJson).not.toHaveBeenCalled();
  });

  test("selecciona el mejor resultado sin eliminar los demas", async () => {
    service.seleccionarResultado.mockResolvedValue({ id: 3, esSeleccionada: true });
    const response = await request(createApp())
      .patch("/api/gerencia/facturas-ia/3/seleccionar");
    expect(response.status).toBe(200);
    expect(service.seleccionarResultado).toHaveBeenCalledWith({ id: "3", usuarioId: 7 });
  });
});
