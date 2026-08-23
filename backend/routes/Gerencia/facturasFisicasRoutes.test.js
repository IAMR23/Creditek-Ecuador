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

jest.mock("../../controllers/Gerencia/facturasFisicasController", () => ({
  actualizarFactura: (_req, res) => res.json({ ok: true }),
  anularFactura: (_req, res) => res.json({ ok: true }),
  aplicarOcr: (_req, res) => res.json({ ok: true, accion: "aplicar" }),
  listarFacturas: (_req, res) => res.json({ ok: true }),
  listarProductosOcr: (_req, res) =>
    res.json({ ok: true, accion: "listar-productos" }),
  obtenerFactura: (_req, res) => res.json({ ok: true }),
  editarProductoOcr: (_req, res) =>
    res.json({ ok: true, accion: "editar-producto" }),
  confirmarProductoOcr: (_req, res) =>
    res.json({ ok: true, accion: "confirmar-producto" }),
  descartarProductoOcr: (_req, res) =>
    res.json({ ok: true, accion: "descartar-producto" }),
  procesarOcr: (_req, res) => res.json({ ok: true, accion: "ocr" }),
  subirFactura: (_req, res) => res.json({ ok: true }),
  verArchivo: (_req, res) => res.json({ ok: true }),
}));

jest.mock("../../services/facturasFisicasService", () => ({
  MAX_FILE_SIZE_BYTES: 15 * 1024 * 1024,
  MIME_EXTENSIONS: {
    "image/jpeg": [".jpg", ".jpeg"],
    "image/png": [".png"],
    "image/webp": [".webp"],
    "application/pdf": [".pdf"],
  },
}));

const routes = require("./facturasFisicasRoutes");

const crearApp = () => {
  const app = express();
  app.use(express.json());
  app.use("/api/gerencia/facturas-fisicas", routes);
  return app;
};

describe("facturasFisicasRoutes OCR", () => {
  test("usuario autorizado procesa OCR manual", async () => {
    const response = await request(crearApp())
      .post("/api/gerencia/facturas-fisicas/7/ocr")
      .set("x-test-permisos", "Gerencia")
      .expect(200);
    expect(response.body.accion).toBe("ocr");
  });

  test("usuario sin permiso recibe 403", async () => {
    await request(crearApp())
      .post("/api/gerencia/facturas-fisicas/7/ocr")
      .set("x-test-permisos", "Ventas")
      .expect(403);
  });

  test("aplica sugerencias por endpoint protegido y no expone endpoint de eliminacion", async () => {
    const response = await request(crearApp())
      .patch("/api/gerencia/facturas-fisicas/7/aplicar-ocr")
      .set("x-test-permisos", "Administracion")
      .send({ campos: ["total"] })
      .expect(200);
    expect(response.body.accion).toBe("aplicar");

    await request(crearApp())
      .delete("/api/gerencia/facturas-fisicas/7")
      .set("x-test-permisos", "Gerencia")
      .expect(404);
  });

  test("expone revision de productos sin endpoint destructivo", async () => {
    const base = "/api/gerencia/facturas-fisicas/7/productos-ocr";
    const headers = { "x-test-permisos": "Gerencia" };

    expect(
      (await request(crearApp()).get(base).set(headers).expect(200)).body.accion,
    ).toBe("listar-productos");
    expect(
      (
        await request(crearApp())
          .patch(`${base}/11`)
          .set(headers)
          .send({ descripcion: "Producto corregido" })
          .expect(200)
      ).body.accion,
    ).toBe("editar-producto");
    expect(
      (
        await request(crearApp())
          .patch(`${base}/11/confirmar`)
          .set(headers)
          .expect(200)
      ).body.accion,
    ).toBe("confirmar-producto");
    expect(
      (
        await request(crearApp())
          .patch(`${base}/11/descartar`)
          .set(headers)
          .expect(200)
      ).body.accion,
    ).toBe("descartar-producto");
    await request(crearApp()).delete(`${base}/11`).set(headers).expect(404);
  });
});
