const express = require("express");
const request = require("supertest");

jest.mock("../../controllers/Gerencia/informesController", () => ({
  obtenerReporte: jest.fn(),
  formatearReporte: jest.fn(),
  obtenerVentasConEntrega: jest.fn((req, res) =>
    res.json({ ok: true, filtros: req.query }),
  ),
}));

jest.mock("../../middleware/authMiddleware", () => ({
  authenticate: (req, res, next) => {
    if (req.headers.authorization !== "Bearer valido") {
      return res.status(401).json({ message: "No token" });
    }
    req.user = {
      permisos: String(req.headers["x-test-permisos"] || "")
        .split(",")
        .filter(Boolean),
    };
    return next();
  },
  requirePermission: (...permitidos) => (req, res, next) => {
    if (!permitidos.some((permiso) => req.user.permisos.includes(permiso))) {
      return res.status(403).json({ message: "Sin permiso" });
    }
    return next();
  },
}));

const routes = require("./informesRoutes");

const crearAplicacion = () => {
  const app = express();
  app.use("/api/gerencia", routes);
  return app;
};

describe("GET /api/gerencia/informe-ventas-con-entrega", () => {
  test("requiere autenticacion", async () => {
    const response = await request(crearAplicacion()).get(
      "/api/gerencia/informe-ventas-con-entrega",
    );
    expect(response.status).toBe(401);
  });

  test("requiere permiso de Gerencia", async () => {
    const response = await request(crearAplicacion())
      .get("/api/gerencia/informe-ventas-con-entrega")
      .set("Authorization", "Bearer valido")
      .set("x-test-permisos", "Logistica");
    expect(response.status).toBe(403);
  });

  test("permite consultar con autenticacion y permiso", async () => {
    const response = await request(crearAplicacion())
      .get("/api/gerencia/informe-ventas-con-entrega")
      .query({ estadoEntrega: "Entregado" })
      .set("Authorization", "Bearer valido")
      .set("x-test-permisos", "Gerencia");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      filtros: { estadoEntrega: "Entregado" },
    });
  });
});
