const express = require("express");
const request = require("supertest");

const mockRequirePermission = jest.fn(() => (_req, _res, next) => next());

jest.mock("../../middleware/authMiddleware", () => ({
  authenticate: (req, res, next) => {
    if (req.headers["x-test-sin-auth"] === "1") {
      return res.status(401).json({ message: "No autenticado" });
    }
    req.user = { id: 7, permisos: ["Contabilidad"] };
    return next();
  },
  requirePermission: (...args) => mockRequirePermission(...args),
}));

jest.mock("../../controllers/Contabilidad/controlFinancieroController", () => ({
  listarCargas: (_req, res) => res.json({ accion: "listar" }),
  consolidarVentas: (_req, res) => res.json({ accion: "consolidar" }),
  obtenerCarga: (_req, res) => res.json({ accion: "detalle" }),
  anularCarga: (_req, res) => res.json({ accion: "anular" }),
  listarResponsablesPagoEntrada: (_req, res) =>
    res.json({ accion: "responsables" }),
  actualizarPagoEntrada: (req, res) =>
    res.json({ accion: "actualizar-pago", registroId: req.params.registroId }),
  obtenerConciliacionEntradas: (req, res) =>
    res.json({ accion: "obtener-conciliacion", cargaId: req.params.cargaId }),
  reconciliarEntradas: (req, res) =>
    res.json({ accion: "reconciliar", cargaId: req.params.cargaId }),
  confirmarConciliacionEntrada: (req, res) =>
    res.json({
      accion: "confirmar",
      cargaId: req.params.cargaId,
      resultadoId: req.params.resultadoId,
    }),
}));

const routes = require("./controlFinancieroRoutes");

const crearApp = () => {
  const app = express();
  app.use(express.json());
  app.use("/api/contabilidad/control-financiero", routes);
  return app;
};

describe("controlFinancieroRoutes conciliacion de entradas", () => {
  test("mantiene permisos de Contabilidad y Administracion", () => {
    expect(mockRequirePermission).toHaveBeenCalledWith(
      "Contabilidad",
      "Administracion",
    );
  });

  test("expone el endpoint GET protegido solicitado", async () => {
    const response = await request(crearApp())
      .get(
        "/api/contabilidad/control-financiero/cargas/25/conciliacion-entradas",
      )
      .expect(200);

    expect(response.body).toEqual({
      accion: "obtener-conciliacion",
      cargaId: "25",
    });
  });

  test("rechaza la consulta sin autenticacion", async () => {
    await request(crearApp())
      .get(
        "/api/contabilidad/control-financiero/cargas/25/conciliacion-entradas",
      )
      .set("x-test-sin-auth", "1")
      .expect(401);
  });

  test("expone reejecucion y confirmacion manual", async () => {
    const app = crearApp();
    const reconciliar = await request(app)
      .post(
        "/api/contabilidad/control-financiero/cargas/25/conciliacion-entradas/reconciliar",
      )
      .expect(200);
    const confirmar = await request(app)
      .post(
        "/api/contabilidad/control-financiero/cargas/25/conciliacion-entradas/resultado-1/confirmar",
      )
      .send({ clienteControlNormalizado: "CLIENTE" })
      .expect(200);

    expect(reconciliar.body.accion).toBe("reconciliar");
    expect(confirmar.body).toEqual({
      accion: "confirmar",
      cargaId: "25",
      resultadoId: "resultado-1",
    });
  });

  test("expone responsables y actualizacion de pago protegidos", async () => {
    const app = crearApp();
    const responsables = await request(app)
      .get("/api/contabilidad/control-financiero/responsables-pago")
      .expect(200);
    const actualizar = await request(app)
      .patch(
        "/api/contabilidad/control-financiero/registros/21/pago-entrada",
      )
      .send({ estado: "PAGADO", responsableUsuarioId: 8 })
      .expect(200);

    expect(responsables.body).toEqual({ accion: "responsables" });
    expect(actualizar.body).toEqual({
      accion: "actualizar-pago",
      registroId: "21",
    });
  });
});
