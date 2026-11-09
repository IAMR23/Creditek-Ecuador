jest.mock("../config/db", () => ({
  sequelize: {
    transaction: jest.fn(async (callback) =>
      callback({ LOCK: { UPDATE: "UPDATE", SHARE: "SHARE" } }),
    ),
  },
}));

jest.mock("../models/CostoHistorico", () => ({
  findByPk: jest.fn(),
  findAll: jest.fn(),
}));

jest.mock("../models/DetalleVenta", () => ({
  findAll: jest.fn(),
}));

jest.mock("../models/Venta", () => ({}));

const CostoHistorico = require("../models/CostoHistorico");
const DetalleVenta = require("../models/DetalleVenta");
const {
  calcularMargenDetalle,
  eliminarCostoHistoricoConRecalculo,
  reajustarVentasPorRango,
} = require("./costoHistoricoService");

describe("costoHistoricoService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("recalcula costo y margen con el historico vigente para cada venta", async () => {
    const costoEliminado = {
      id: 15,
      modeloId: 8,
      fechaCompra: "2026-09-07",
      destroy: jest.fn().mockResolvedValue(undefined),
    };
    const detalleSeptiembre = {
      modeloId: 8,
      precioVendedor: 420,
      alcance: 0,
      venta: { fecha: "2026-09-20" },
      update: jest.fn().mockResolvedValue(undefined),
    };
    const detalleOctubre = {
      modeloId: 8,
      precioVendedor: 420,
      alcance: 0,
      venta: { fecha: "2026-10-04" },
      update: jest.fn().mockResolvedValue(undefined),
    };

    CostoHistorico.findByPk.mockResolvedValue(costoEliminado);
    CostoHistorico.findAll.mockResolvedValue([
      { id: 18, fechaCompra: "2026-10-03", costo: 319.84 },
      { id: 4, fechaCompra: "2026-03-19", costo: 314 },
    ]);
    DetalleVenta.findAll.mockResolvedValue([
      detalleSeptiembre,
      detalleOctubre,
    ]);

    const resultado = await eliminarCostoHistoricoConRecalculo("15");

    expect(costoEliminado.destroy).toHaveBeenCalledWith({
      transaction: expect.any(Object),
    });
    expect(detalleSeptiembre.update).toHaveBeenCalledWith(
      { costo: 314, margen: 106 },
      { transaction: expect.any(Object) },
    );
    expect(detalleOctubre.update).toHaveBeenCalledWith(
      { costo: 319.84, margen: 100.16 },
      { transaction: expect.any(Object) },
    );
    expect(resultado).toEqual({
      costoEliminadoId: 15,
      modeloId: 8,
      fechaDesde: "2026-09-07",
      ventasRecalculadas: 2,
    });
  });

  test("rechaza la eliminacion si una venta quedaria sin costo aplicable", async () => {
    const costoEliminado = {
      id: 4,
      modeloId: 8,
      fechaCompra: "2026-03-19",
      destroy: jest.fn().mockResolvedValue(undefined),
    };
    CostoHistorico.findByPk.mockResolvedValue(costoEliminado);
    CostoHistorico.findAll.mockResolvedValue([
      { id: 18, fechaCompra: "2026-10-03", costo: 319.84 },
    ]);
    DetalleVenta.findAll.mockResolvedValue([
      {
        modeloId: 8,
        precioVendedor: 420,
        alcance: 0,
        venta: { fecha: "2026-04-01" },
        update: jest.fn(),
      },
    ]);

    await expect(eliminarCostoHistoricoConRecalculo("4")).rejects.toMatchObject({
      statusCode: 409,
      code: "VENTAS_SIN_COSTO_HISTORICO",
    });
  });

  test("calcula el margen igual que la creacion de ventas", () => {
    expect(
      calcularMargenDetalle({ precioVendedor: 400, alcance: 20 }, 314),
    ).toBe(106);
  });

  test("reajusta todas las ventas activas dentro del rango", async () => {
    const detalleTv = {
      modeloId: 8,
      precioVendedor: 400,
      alcance: 20,
      venta: { fecha: "2026-04-10" },
      update: jest.fn().mockResolvedValue(undefined),
    };
    const detalleCelular = {
      modeloId: 12,
      precioVendedor: 300,
      alcance: 0,
      venta: { fecha: "2026-05-05" },
      update: jest.fn().mockResolvedValue(undefined),
    };
    DetalleVenta.findAll.mockResolvedValue([detalleTv, detalleCelular]);
    CostoHistorico.findAll.mockResolvedValue([
      { id: 4, modeloId: 8, fechaCompra: "2026-03-19", costo: 314 },
      { id: 9, modeloId: 12, fechaCompra: "2026-05-01", costo: 250 },
    ]);

    const resultado = await reajustarVentasPorRango({
      fechaDesde: "2026-04-01",
      fechaHasta: "2026-05-31",
    });

    expect(detalleTv.update).toHaveBeenCalledWith(
      { costo: 314, margen: 106 },
      { transaction: expect.any(Object) },
    );
    expect(detalleCelular.update).toHaveBeenCalledWith(
      { costo: 250, margen: 50 },
      { transaction: expect.any(Object) },
    );
    expect(resultado).toEqual({
      fechaDesde: "2026-04-01",
      fechaHasta: "2026-05-31",
      ventasRecalculadas: 2,
      modelosReajustados: 2,
    });
  });

  test("rechaza un rango de fechas invertido", async () => {
    await expect(
      reajustarVentasPorRango({
        fechaDesde: "2026-06-01",
        fechaHasta: "2026-05-01",
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: "RANGO_FECHAS_INVALIDO",
    });
  });
});
