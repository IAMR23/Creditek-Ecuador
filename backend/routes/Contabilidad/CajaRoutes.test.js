const express = require("express");
const request = require("supertest");

jest.mock("../../middleware/authMiddleware", () => ({
  authenticate: (req, res, next) => {
    req.user = {
      id: 1,
      rol: req.headers["x-test-rol"] || "vendedor",
      permisos: ["Contabilidad", "Administracion"],
      agenciaId: 1,
      usuarioAgenciaId: 1,
    };
    next();
  },
  requirePermission: () => (_req, _res, next) => next(),
}));

jest.mock("../../controllers/CierreCaja/cierreCaja", () => ({
  cerrarCaja: (_req, res) => res.json({ ok: true }),
  obtenerCierreCajaPorId: (_req, res) => res.json({ ok: true }),
  obtenerTodosLosCierresCaja: (_req, res) => res.json({ ok: true }),
  obtenerMisCierresCaja: (_req, res) => res.json({ ok: true }),
  obtenerCierresCajaLegacy: (_req, res) => res.json({ ok: true }),
  obtenerEstadoCierreUsuario: (_req, res) => res.json({ ok: true }),
  obtenerFiltrosCierresCaja: (_req, res) => res.json({ ok: true }),
  reabrirCierreCaja: (_req, res) => res.json({ ok: true }),
  actualizarCierreCajaReabierto: (_req, res) => res.json({ ok: true }),
}));

const cajaRoutes = require("./CajaRoutes");

const crearApp = () => {
  const app = express();
  app.use(express.json());
  app.use(cajaRoutes);
  return app;
};

describe("CajaRoutes", () => {
  test("rechaza reapertura si el rol no es administrador", async () => {
    await request(crearApp())
      .patch("/cierre-caja/1/reabrir")
      .set("x-test-rol", "vendedor")
      .send({ motivo: "Correccion" })
      .expect(403);
  });

  test("permite reapertura a rol administrador", async () => {
    await request(crearApp())
      .patch("/cierre-caja/1/reabrir")
      .set("x-test-rol", "administrador")
      .send({ motivo: "Correccion" })
      .expect(200);
  });

  test("rechaza edicion de cierre si el rol no es administrador", async () => {
    await request(crearApp())
      .put("/cierre-caja/1")
      .set("x-test-rol", "Contabilidad")
      .send({ movimientos: [] })
      .expect(403);
  });
});
