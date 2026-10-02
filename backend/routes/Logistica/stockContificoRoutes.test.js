const express = require("express");
const request = require("supertest");

jest.mock("../../middleware/authMiddleware", () => ({
  authenticate: (req, _res, next) => {
    req.user = {
      id: 9,
      permisos: String(req.headers["x-test-permisos"] || "")
        .split(",")
        .filter(Boolean),
    };
    next();
  },
  requirePermission: (...allowed) => (req, res, next) =>
    allowed.some((permission) => req.user.permisos.includes(permission))
      ? next()
      : res.status(403).json({ ok: false, message: "Sin permiso" }),
}));

jest.mock("../../controllers/Logistica/stockContificoController", () => ({
  catalogo: (_req, res) => res.json({ ok: true, productos: [] }),
  coberturaBodegas: (_req, res) => res.json({ ok: true, productos: [] }),
  stockProducto: (req, res) => res.json({ ok: true, id: req.params.productoId }),
  stockBodega: (req, res) => res.json({ ok: true, id: req.params.bodegaId }),
}));

const routes = require("./stockContificoRoutes");

const createApp = () => {
  const app = express();
  app.use("/api/logistica/stock-contifico", routes);
  return app;
};

describe("rutas de stock Contifico", () => {
  test.each(["Logistica", "Administracion"])(
    "permite consultar con el permiso %s",
    async (permission) => {
      await request(createApp())
        .get("/api/logistica/stock-contifico/catalogo")
        .set("x-test-permisos", permission)
        .expect(200);
    },
  );

  test("rechaza usuarios sin permisos de Logistica", async () => {
    await request(createApp())
      .get("/api/logistica/stock-contifico/catalogo")
      .set("x-test-permisos", "Ventas")
      .expect(403);
  });

  test("protege la cobertura producto-bodega con el mismo permiso", async () => {
    await request(createApp())
      .get("/api/logistica/stock-contifico/cobertura-bodegas")
      .set("x-test-permisos", "Logistica")
      .expect(200);

    await request(createApp())
      .get("/api/logistica/stock-contifico/cobertura-bodegas")
      .set("x-test-permisos", "Ventas")
      .expect(403);
  });
});
