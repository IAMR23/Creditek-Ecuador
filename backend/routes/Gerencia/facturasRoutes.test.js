const express = require("express");
const request = require("supertest");

jest.mock("../../middleware/authMiddleware", () => ({
  authenticate: (req, _res, next) => {
    req.user = { id: 9, permisos: String(req.headers["x-test-permisos"] || "").split(",") };
    next();
  },
  requirePermission: (...allowed) => (req, res, next) =>
    allowed.some((permission) => req.user.permisos.includes(permission))
      ? next()
      : res.status(403).json({ ok: false, message: "Sin permiso" }),
}));
jest.mock("../../controllers/Gerencia/facturasController", () => ({
  actualizar: (_req, res) => res.json({ ok: true }),
  cargarExcel: (_req, res) => res.status(201).json({ ok: true }),
  cargarFoto: (_req, res) => res.json({ ok: true }),
  listar: (_req, res) => res.json({ ok: true, facturas: [] }),
  cargarJson: (_req, res) => res.status(201).json({ ok: true }),
  cargarJsonTexto: (_req, res) => res.status(201).json({ ok: true }),
}));
jest.mock("../../services/facturasService", () => ({
  FACTURA_IMAGE_EXTENSIONS: {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
  },
  MAX_FACTURA_IMAGE_BYTES: 600 * 1024,
  MAX_JSON_BYTES: 5 * 1024 * 1024,
}));

const routes = require("./facturasRoutes");

const createApp = () => {
  const app = express();
  app.use("/api/gerencia/facturas", routes);
  return app;
};

describe("rutas de facturas", () => {
  test.each(["Gerencia", "Administracion"])("permite listar con %s", async (permission) => {
    await request(createApp())
      .get("/api/gerencia/facturas")
      .set("x-test-permisos", permission)
      .expect(200);
  });

  test("rechaza usuarios sin permisos", async () => {
    await request(createApp())
      .get("/api/gerencia/facturas")
      .set("x-test-permisos", "Ventas")
      .expect(403);
  });

  test("permite editar una factura con permiso de Gerencia", async () => {
    await request(createApp())
      .patch("/api/gerencia/facturas/7")
      .set("x-test-permisos", "Gerencia")
      .send({ proveedor: "Proveedor actualizado" })
      .expect(200);
  });

  test("rechaza archivos que no sean JSON", async () => {
    await request(createApp())
      .post("/api/gerencia/facturas/carga-json")
      .set("x-test-permisos", "Gerencia")
      .attach("archivo", Buffer.from("texto"), "facturas.txt")
      .expect(400);
  });

  test("recibe contenido JSON pegado", async () => {
    await request(createApp())
      .post("/api/gerencia/facturas/carga-json-texto")
      .set("x-test-permisos", "Gerencia")
      .field("contenido", '[{"numeroFactura":"001"}]')
      .expect(201);
  });

  test("acepta archivos Excel .xlsx", async () => {
    await request(createApp())
      .post("/api/gerencia/facturas/carga-excel")
      .set("x-test-permisos", "Gerencia")
      .attach("archivo", Buffer.from("xlsx"), "facturas.xlsx")
      .expect(201);
  });

  test("rechaza archivos Excel con otra extension", async () => {
    await request(createApp())
      .post("/api/gerencia/facturas/carga-excel")
      .set("x-test-permisos", "Gerencia")
      .attach("archivo", Buffer.from("xls"), "facturas.xls")
      .expect(400);
  });

  test("acepta una foto WEBP ligera por factura", async () => {
    await request(createApp())
      .post("/api/gerencia/facturas/7/foto")
      .set("x-test-permisos", "Gerencia")
      .attach("foto", Buffer.from("RIFF0000WEBPimagen"), {
        filename: "factura.webp",
        contentType: "image/webp",
      })
      .expect(200);
  });

  test("rechaza formatos que no sean imagen", async () => {
    await request(createApp())
      .post("/api/gerencia/facturas/7/foto")
      .set("x-test-permisos", "Gerencia")
      .attach("foto", Buffer.from("archivo"), "factura.pdf")
      .expect(400);
  });
});
