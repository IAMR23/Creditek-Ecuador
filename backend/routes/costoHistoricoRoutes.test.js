const express = require("express");
const request = require("supertest");

jest.mock("../models/CostoHistorico", () => ({
  findAll: jest.fn(),
  findByPk: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
}));

jest.mock("../models/Modelo", () => ({
  findByPk: jest.fn(),
}));

jest.mock("../controllers/listaPreciosController", () => ({
  obtener: jest.fn(),
  guardar: jest.fn(),
}));

jest.mock("../services/costoHistoricoService", () => ({
  eliminarCostoHistoricoConRecalculo: jest.fn(),
  reajustarVentasPorRango: jest.fn(),
}));

jest.mock("../middleware/authMiddleware", () => ({
  authenticate: (req, res, next) => {
    if (req.get("X-Test-Authenticated") === "1") return next();
    return res.status(401).json({ message: "No autorizado" });
  },
  requirePermission: () => (req, res, next) => {
    if (req.get("X-Test-Permission") === "Catalogos") return next();
    return res.status(403).json({ message: "Sin permiso" });
  },
}));

const CostoHistorico = require("../models/CostoHistorico");
const {
  eliminarCostoHistoricoConRecalculo,
  reajustarVentasPorRango,
} = require("../services/costoHistoricoService");
const routes = require("./costoHistoricoRoutes");

const crearApp = () => {
  const app = express();
  app.use(express.json());
  app.use("/costos", routes);
  return app;
};

describe("DELETE /costos/:id", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    eliminarCostoHistoricoConRecalculo.mockResolvedValue({
      costoEliminadoId: 15,
      modeloId: 8,
      fechaDesde: "2026-09-07",
      ventasRecalculadas: 4,
    });
    reajustarVentasPorRango.mockResolvedValue({
      fechaDesde: "2026-03-19",
      fechaHasta: "2026-10-31",
      ventasRecalculadas: 12,
      modelosReajustados: 3,
    });
  });

  test("rechaza la eliminacion sin autenticacion", async () => {
    const response = await request(crearApp()).delete("/costos/15");

    expect(response.status).toBe(401);
    expect(CostoHistorico.findByPk).not.toHaveBeenCalled();
  });

  test("elimina cuando el usuario tiene permiso de Catalogos", async () => {
    const response = await request(crearApp())
      .delete("/costos/15")
      .set("X-Test-Authenticated", "1")
      .set("X-Test-Permission", "Catalogos");

    expect(response.status).toBe(200);
    expect(eliminarCostoHistoricoConRecalculo).toHaveBeenCalledWith("15");
    expect(response.body).toEqual({
      message: "Costo historico eliminado y ventas recalculadas correctamente",
      costoEliminadoId: 15,
      modeloId: 8,
      fechaDesde: "2026-09-07",
      ventasRecalculadas: 4,
    });
  });

  test("reajusta las ventas del rango solicitado", async () => {
    const response = await request(crearApp())
      .post("/costos/reajustar")
      .set("X-Test-Authenticated", "1")
      .set("X-Test-Permission", "Catalogos")
      .send({ fechaDesde: "2026-03-19", fechaHasta: "2026-10-31" });

    expect(response.status).toBe(200);
    expect(reajustarVentasPorRango).toHaveBeenCalledWith({
      fechaDesde: "2026-03-19",
      fechaHasta: "2026-10-31",
    });
    expect(response.body).toEqual({
      message: "Ventas reajustadas correctamente",
      fechaDesde: "2026-03-19",
      fechaHasta: "2026-10-31",
      ventasRecalculadas: 12,
      modelosReajustados: 3,
    });
  });
});
