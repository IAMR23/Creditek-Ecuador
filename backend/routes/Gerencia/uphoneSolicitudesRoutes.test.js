const express = require("express");
const request = require("supertest");

jest.mock("../../services/uphoneSolicitudesService", () => ({
  MAX_FILE_SIZE_BYTES: 10 * 1024 * 1024,
}));
jest.mock("../../controllers/Gerencia/uphoneSolicitudesController", () => ({
  eliminar: jest.fn((_req, res) => res.json({ ok: true })),
  exportar: jest.fn((_req, res) => res.send(Buffer.from("excel"))),
  listar: jest.fn((_req, res) => res.json({ ok: true, solicitudes: [] })),
  importarApiKey: jest.fn((req, res) =>
    res.status(201).json({ ok: true, archivo: req.file.originalname }),
  ),
  importarManual: jest.fn((req, res) =>
    res.status(201).json({ ok: true, archivo: req.file.originalname }),
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

const controller = require("../../controllers/Gerencia/uphoneSolicitudesController");
const routes = require("./uphoneSolicitudesRoutes");

const createApp = () => {
  const app = express();
  app.use("/api/uphone/solicitudes", routes);
  return app;
};

describe("rutas de solicitudes Uphone", () => {
  const apiKey = "uph_test_12345678901234567890123456789012";

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.API_KEY_RVE = apiKey;
  });

  afterAll(() => {
    delete process.env.API_KEY_RVE;
  });

  test.each(["Gerencia", "Administracion", "Sistemas"])(
    "permite consultar con el permiso %s",
    async (permission) => {
      const response = await request(createApp())
        .get("/api/uphone/solicitudes")
        .set("x-test-permission", permission);
      expect(response.status).toBe(200);
      expect(controller.listar).toHaveBeenCalled();
    },
  );

  test("rechaza usuarios sin un permiso autorizado", async () => {
    const response = await request(createApp())
      .get("/api/uphone/solicitudes")
      .set("x-test-permission", "Marketing");
    expect(response.status).toBe(403);
  });

  test("permite exportar con sesion RVE y permiso autorizado", async () => {
    const response = await request(createApp())
      .get("/api/uphone/solicitudes/exportar?estado=PENDIENTE")
      .set("x-test-permission", "Gerencia");
    expect(response.status).toBe(200);
    expect(controller.exportar).toHaveBeenCalled();
    expect(controller.exportar.mock.calls[0][0].query.estado).toBe("PENDIENTE");
  });

  test("permite eliminar con sesion RVE y permiso autorizado", async () => {
    const response = await request(createApp())
      .delete("/api/uphone/solicitudes/14")
      .set("x-test-permission", "Sistemas");
    expect(response.status).toBe(200);
    expect(controller.eliminar).toHaveBeenCalled();
    expect(controller.eliminar.mock.calls[0][0].params.id).toBe("14");
  });

  test("no permite eliminar sin un permiso autorizado", async () => {
    const response = await request(createApp())
      .delete("/api/uphone/solicitudes/14")
      .set("x-test-permission", "Marketing");
    expect(response.status).toBe(403);
    expect(controller.eliminar).not.toHaveBeenCalled();
  });

  test("acepta un Excel xlsx con API key y sin ejecutar autenticacion JWT", async () => {
    const response = await request(createApp())
      .post("/api/uphone/solicitudes/importar")
      .set("x-api-key", apiKey)
      .attach("archivo", Buffer.from("xlsx-prueba"), "solicitudes.xlsx");
    expect(response.status).toBe(201);
    expect(controller.importarApiKey).toHaveBeenCalled();
    expect(mockAuthenticate).not.toHaveBeenCalled();
    expect(response.body.archivo).toBe("solicitudes.xlsx");
  });

  test("rechaza la carga cuando falta la API key", async () => {
    const response = await request(createApp())
      .post("/api/uphone/solicitudes/importar")
      .attach("archivo", Buffer.from("xlsx-prueba"), "solicitudes.xlsx");
    expect(response.status).toBe(401);
    expect(response.body.code).toBe("UPHONE_API_KEY_MISSING");
    expect(controller.importarApiKey).not.toHaveBeenCalled();
  });

  test("rechaza la carga con una API key incorrecta", async () => {
    const response = await request(createApp())
      .post("/api/uphone/solicitudes/importar")
      .set("x-api-key", "uph_bad_12345678901234567890123456789012")
      .attach("archivo", Buffer.from("xlsx-prueba"), "solicitudes.xlsx");
    expect(response.status).toBe(401);
    expect(response.body.code).toBe("UPHONE_API_KEY_INVALID");
    expect(controller.importarApiKey).not.toHaveBeenCalled();
  });

  test("rechaza archivos con otra extension", async () => {
    const response = await request(createApp())
      .post("/api/uphone/solicitudes/importar")
      .set("x-api-key", apiKey)
      .attach("archivo", Buffer.from("dato"), "solicitudes.xls");
    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/\.xlsx/i);
    expect(controller.importarApiKey).not.toHaveBeenCalled();
  });

  test("permite una carga manual con sesion RVE y permiso autorizado", async () => {
    const response = await request(createApp())
      .post("/api/uphone/solicitudes/importar-manual")
      .set("x-test-permission", "Gerencia")
      .attach("archivo", Buffer.from("xlsx-prueba"), "solicitudes.xlsx");
    expect(response.status).toBe(201);
    expect(mockAuthenticate).toHaveBeenCalled();
    expect(controller.importarManual).toHaveBeenCalled();
    expect(controller.importarApiKey).not.toHaveBeenCalled();
  });

  test("la carga manual no acepta usuarios sin permiso", async () => {
    const response = await request(createApp())
      .post("/api/uphone/solicitudes/importar-manual")
      .set("x-test-permission", "Marketing")
      .attach("archivo", Buffer.from("xlsx-prueba"), "solicitudes.xlsx");
    expect(response.status).toBe(403);
    expect(controller.importarManual).not.toHaveBeenCalled();
  });
});
