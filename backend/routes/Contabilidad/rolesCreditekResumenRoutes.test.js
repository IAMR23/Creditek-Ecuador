const express = require("express");
const request = require("supertest");

jest.mock("../../middleware/authMiddleware", () => ({
  authenticate: (req, _res, next) => {
    req.user = { id: 7, permisos: [req.headers["x-test-rol"]].filter(Boolean) };
    next();
  },
  requirePermission: (...permissions) => (req, res, next) => {
    if (permissions.some((permission) => req.user.permisos.includes(permission))) {
      return next();
    }
    return res.status(403).json({ message: "Sin permiso" });
  },
}));
jest.mock("../../controllers/Contabilidad/rolesCreditekResumenController", () => ({
  obtenerResumen: (_req, res) => res.json({ ok: true }),
  guardarAjustes: (_req, res) => res.json({ ok: true }),
}));

const routes = require("./rolesCreditekResumenRoutes");

describe("rolesCreditekResumenRoutes", () => {
  const app = express();
  app.use(express.json());
  app.use("/api/contabilidad/roles-creditek-resumen", routes);

  test.each(["Contabilidad", "Administracion"])(
    "permite acceso con permiso %s",
    async (permiso) => {
      await request(app)
        .get("/api/contabilidad/roles-creditek-resumen?anio=2026&mes=8")
        .set("x-test-rol", permiso)
        .expect(200, { ok: true });
    },
  );

  test("rechaza usuarios sin permisos contables", async () => {
    await request(app)
      .put("/api/contabilidad/roles-creditek-resumen")
      .set("x-test-rol", "Ventas")
      .send({})
      .expect(403);
  });
});
