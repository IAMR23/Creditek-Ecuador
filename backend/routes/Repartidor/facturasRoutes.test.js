const express = require("express");
const request = require("supertest");

jest.mock("../../middleware/authMiddleware", () => ({
  authenticate: (req, _res, next) => {
    req.user = {
      id: 9,
      rol: req.headers["x-test-rol"] || "repartidor",
      permisos: String(req.headers["x-test-permisos"] || "")
        .split(",")
        .filter(Boolean),
    };
    next();
  },
  requirePermission: (...required) => (req, res, next) =>
    required.some((permission) => req.user.permisos.includes(permission))
      ? next()
      : res.status(403).json({ message: "Permiso insuficiente" }),
}));
jest.mock("../../controllers/Repartidor/facturasController", () => ({
  cargarFoto: (_req, res) => res.status(201).json({ ok: true }),
}));
jest.mock("../../services/facturasService", () => ({
  FACTURA_IMAGE_EXTENSIONS: { "image/webp": ".webp" },
  MAX_FACTURA_IMAGE_BYTES: 600 * 1024,
}));

const routes = require("./facturasRoutes");

const createApp = () => {
  const app = express();
  app.use("/api/repartidor/facturas", routes);
  return app;
};

describe("rutas de fotos de facturas para repartidor", () => {
  test("rechaza al repartidor sin permiso Logistica", async () => {
    await request(createApp())
      .post("/api/repartidor/facturas")
      .set("x-test-rol", "repartidor")
      .attach("foto", Buffer.from("RIFF0000WEBPimagen"), {
        filename: "factura.webp",
        contentType: "image/webp",
      })
      .expect(403);
  });

  test("permite al repartidor cargar una foto WebP", async () => {
    await request(createApp())
      .post("/api/repartidor/facturas")
      .set("x-test-rol", "repartidor")
      .set("x-test-permisos", "Logistica")
      .attach("foto", Buffer.from("RIFF0000WEBPimagen"), {
        filename: "factura.webp",
        contentType: "image/webp",
      })
      .expect(201);
  });

  test("rechaza otros roles", async () => {
    await request(createApp())
      .post("/api/repartidor/facturas")
      .set("x-test-rol", "administrador")
      .set("x-test-permisos", "Logistica")
      .attach("foto", Buffer.from("RIFF0000WEBPimagen"), {
        filename: "factura.webp",
        contentType: "image/webp",
      })
      .expect(403);
  });

  test("rechaza archivos que no sean WebP", async () => {
    await request(createApp())
      .post("/api/repartidor/facturas")
      .set("x-test-rol", "repartidor")
      .set("x-test-permisos", "Logistica")
      .attach("foto", Buffer.from("archivo"), "factura.pdf")
      .expect(400);
  });
});
