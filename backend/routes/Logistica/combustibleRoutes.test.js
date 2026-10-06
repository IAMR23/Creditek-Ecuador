const express = require("express");
const request = require("supertest");

jest.mock("../../middleware/authMiddleware", () => {
  const real = jest.requireActual("../../middleware/authMiddleware");
  return {
    ...real,
    authenticate: (req, res, next) => {
      if (!req.headers["x-test-rol"]) return real.authenticate(req, res, next);
      req.user = {
        id: 9,
        rol: req.headers["x-test-rol"],
        permisos: String(req.headers["x-test-permisos"] || "")
          .split(",")
          .filter(Boolean),
      };
      next();
    },
  };
});
jest.mock("../../services/logisticaCombustibleService", () => ({
  listar: jest.fn(async () => ({ registros: [] })),
  obtener: jest.fn(async () => ({ id: 3 })),
  crear: jest.fn(async () => ({ id: 3 })),
  actualizar: jest.fn(async () => ({ id: 3 })),
  eliminar: jest.fn(async () => undefined),
  repartidores: jest.fn(async () => []),
}));

const servicio = require("../../services/logisticaCombustibleService");
const router = require("./combustibleRoutes");
const app = express();
app.use(express.json());
app.use("/api/logistica/combustible", router);
const BASE = "/api/logistica/combustible";

describe("rutas de combustible con middleware real de roles y permisos", () => {
  beforeEach(() => jest.clearAllMocks());
  test.each(["get", "post", "put", "delete"])(
    "%s requiere autenticación",
    async (method) => {
      await request(app)
        [method](method === "get" || method === "post" ? BASE : `${BASE}/3`)
        .expect(401);
    },
  );
  test("el repartidor accede al CRUD sin permisos administrativos", async () => {
    await request(app).get(BASE).set("x-test-rol", "REPARTIDOR").expect(200);
    await request(app)
      .get(`${BASE}/3`)
      .set("x-test-rol", "REPARTIDOR")
      .expect(200);
    const creada = await request(app)
      .post(BASE)
      .set("x-test-rol", "REPARTIDOR")
      .send({ fecha: "2026-10-06" })
      .expect(201);
    expect(creada.body.registro.id).toBe(3);
    await request(app)
      .put(`${BASE}/3`)
      .set("x-test-rol", "REPARTIDOR")
      .send({})
      .expect(200);
    await request(app)
      .delete(`${BASE}/3`)
      .set("x-test-rol", "REPARTIDOR")
      .expect(200);
  });
  test.each(["Logistica", "Administración"])(
    "administrador con %s consulta y elimina",
    async (permiso) => {
      for (const path of [BASE, `${BASE}/3`, `${BASE}/repartidores`]) {
        await request(app)
          .get(path)
          .set("x-test-rol", "administrador")
          .set("x-test-permisos", permiso)
          .expect(200);
      }
      await request(app)
        .delete(`${BASE}/3`)
        .set("x-test-rol", "admin")
        .set("x-test-permisos", permiso)
        .expect(200);
    },
  );
  test("el administrador no registra ni edita", async () => {
    await request(app)
      .post(BASE)
      .set("x-test-rol", "admin")
      .set("x-test-permisos", "Logistica")
      .expect(403);
    await request(app)
      .put(`${BASE}/3`)
      .set("x-test-rol", "admin")
      .set("x-test-permisos", "Logistica")
      .expect(403);
    expect(servicio.crear).not.toHaveBeenCalled();
    expect(servicio.actualizar).not.toHaveBeenCalled();
  });
  test("deniega catálogo a repartidor aunque tenga Administración", async () => {
    await request(app)
      .get(`${BASE}/repartidores`)
      .set("x-test-rol", "repartidor")
      .set("x-test-permisos", "Administracion")
      .expect(403);
    expect(servicio.repartidores).not.toHaveBeenCalled();
  });
  test("un permiso no sustituye el rol; un administrador necesita permiso", async () => {
    await request(app)
      .get(BASE)
      .set("x-test-rol", "vendedor")
      .set("x-test-permisos", "Logistica,Administracion")
      .expect(403);
    await request(app).get(BASE).set("x-test-rol", "admin").expect(403);
    expect(servicio.listar).not.toHaveBeenCalled();
  });
  test("propaga validación del servicio y oculta detalles internos", async () => {
    servicio.crear.mockRejectedValueOnce(
      Object.assign(new Error("Fecha inválida"), { status: 400 }),
    );
    const invalida = await request(app)
      .post(BASE)
      .set("x-test-rol", "repartidor")
      .send({})
      .expect(400);
    expect(invalida.body.message).toBe("Fecha inválida");
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    servicio.listar.mockRejectedValueOnce(
      new Error("Detalle interno de PostgreSQL"),
    );
    const fallo = await request(app)
      .get(BASE)
      .set("x-test-rol", "repartidor")
      .expect(500);
    expect(fallo.body.message).not.toContain("PostgreSQL");
    log.mockRestore();
  });
});
