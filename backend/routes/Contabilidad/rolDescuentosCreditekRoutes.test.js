jest.mock("../../services/rolDescuentosCreditekService", () => ({ obtener: jest.fn(), crear: jest.fn(), actualizar: jest.fn() }));
jest.mock("../../middleware/authMiddleware", () => ({
  authenticate: (req, res, next) => {
    if (!req.headers["x-test-user"]) return res.sendStatus(401);
    req.user = { id: 9 }; next();
  },
  requirePermission: jest.fn(() => (req, res, next) => req.headers["x-test-permission"] === "Contabilidad" ? next() : res.sendStatus(403)),
}));
const express = require("express");
const request = require("supertest");
const service = require("../../services/rolDescuentosCreditekService");
const { requirePermission } = require("../../middleware/authMiddleware");
const app = express();
app.use(express.json());
app.use("/descuentos", require("./rolDescuentosCreditekRoutes"));

test("protege la sección para Contabilidad y Administración", () => {
  expect(requirePermission).toHaveBeenCalledWith("Contabilidad", "Administracion");
});
test.each([["get", "/"], ["post", "/"], ["put", "/1"], ["patch", "/1/estado"]])("%s %s exige autenticación y permiso", async (method, path) => {
  await request(app)[method](`/descuentos${path}`).expect(401);
  await request(app)[method](`/descuentos${path}`).set("x-test-user", "9").expect(403);
});
test("crea usando el usuario autenticado y devuelve errores de validación", async () => {
  service.crear.mockResolvedValueOnce({ id: 1 });
  await request(app).post("/descuentos").set("x-test-user", "9").set("x-test-permission", "Contabilidad").send({ motivo: "Lentes" }).expect(201);
  expect(service.crear).toHaveBeenCalledWith({ motivo: "Lentes" }, 9);
  service.crear.mockRejectedValueOnce(Object.assign(new Error("Cuota inválida"), { statusCode: 400 }));
  const response = await request(app).post("/descuentos").set("x-test-user", "9").set("x-test-permission", "Contabilidad").send({}).expect(400);
  expect(response.body.message).toBe("Cuota inválida");
});
