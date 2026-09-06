const express = require("express");
const request = require("supertest");
jest.mock("../../middleware/authMiddleware", () => ({
  authenticate: (req, res, next) => {
    if (!req.headers["x-test-rol"]) return res.sendStatus(401);
    req.user = { id: 7, rol: req.headers["x-test-rol"] }; next();
  },
  requirePermission: (...roles) => (req, res, next) => roles.includes(req.user.rol) ? next() : res.sendStatus(403),
}));
jest.mock("../../controllers/Contabilidad/egresosCreditekController", () => ({
  obtenerSeccion: jest.fn(), crearRegistro: jest.fn(), actualizarRegistro: jest.fn(), eliminarRegistro: jest.fn(), cambiarEstadoRegistro: jest.fn(),
}));
jest.mock("../../services/egresosCreditekTiposService", () => ({
  listar: jest.fn(async () => []), crear: jest.fn(async () => ({ id: 1 })), actualizar: jest.fn(async () => ({ id: 1 })),
}));
const service = require("../../services/egresosCreditekTiposService");
const routes = require("./egresosCreditekRoutes");
const app = express(); app.use(express.json()); app.use("/egresos", routes);
beforeEach(() => jest.clearAllMocks());
test.each(["Contabilidad", "Administracion"])("CRUD del catalogo con permiso %s", async (rol) => {
  await request(app).get("/egresos/prestamos/tipos").set("x-test-rol", rol).expect(200, { tipos: [] });
  await request(app).post("/egresos/prestamos/tipos").set("x-test-rol", rol).send({ nombre: "Educacion" }).expect(201);
  expect(service.crear).toHaveBeenCalledWith("prestamos", { nombre: "Educacion" }, 7);
  await request(app).put("/egresos/prestamos/tipos/1").set("x-test-rol", rol).send({ nombre: "Nuevo" }).expect(200);
  await request(app).delete("/egresos/prestamos/tipos/1").set("x-test-rol", rol).expect(200);
  expect(service.actualizar).toHaveBeenLastCalledWith("prestamos", "1", { activo: false }, 7);
});
test.each([["get", "tipos"], ["post", "tipos"], ["put", "tipos/1"], ["delete", "tipos/1"]])("protege %s %s", async (method, path) => {
  await request(app)[method](`/egresos/anticipos/${path}`).expect(401);
  await request(app)[method](`/egresos/anticipos/${path}`).set("x-test-rol", "Ventas").expect(403);
});
