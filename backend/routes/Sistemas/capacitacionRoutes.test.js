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
  requirePermission: (...permitidos) => (req, res, next) =>
    permitidos.some((permiso) => req.user.permisos.includes(permiso))
      ? next()
      : res.status(403).json({ ok: false, message: "Sin permiso" }),
}));

jest.mock("../../controllers/Sistemas/capacitacionController", () => ({
  listar: (_req, res) => res.json({ ok: true, videos: [] }),
  crear: (_req, res) => res.status(201).json({ ok: true }),
  actualizar: (_req, res) => res.json({ ok: true }),
}));

const routes = require("./capacitacionRoutes");

const crearApp = () => {
  const app = express();
  app.use(express.json());
  app.use("/api/sistemas/capacitacion", routes);
  return app;
};

describe("rutas de capacitación", () => {
  test("un usuario autenticado puede listar videos", async () => {
    await request(crearApp())
      .get("/api/sistemas/capacitacion")
      .set("x-test-permisos", "Ventas")
      .expect(200);
  });

  test("solo Sistemas o Administración pueden crear", async () => {
    await request(crearApp())
      .post("/api/sistemas/capacitacion")
      .set("x-test-permisos", "Ventas")
      .expect(403);

    await request(crearApp())
      .post("/api/sistemas/capacitacion")
      .set("x-test-permisos", "Sistemas")
      .expect(201);
  });

  test("solo Sistemas o Administración pueden actualizar", async () => {
    await request(crearApp())
      .patch("/api/sistemas/capacitacion/1")
      .set("x-test-permisos", "Administracion")
      .expect(200);
  });
});
