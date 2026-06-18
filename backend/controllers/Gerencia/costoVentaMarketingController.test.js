jest.mock("../../models/Marketing/PresupuestoMarketing", () => ({
  findOne: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
  create: jest.fn(),
}));

jest.mock("../../models/Marketing/GastoMarketing", () => ({
  sum: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
  create: jest.fn(),
}));

jest.mock("../../models/Entrega", () => ({
  count: jest.fn(),
}));

jest.mock("../Auditoria/auditoriaVentasController", () => ({
  obtenerReporteGerencia: jest.fn(),
  formatearReporte: jest.fn(),
}));

jest.mock("../../utils/calcularEstadisticasVentas", () => ({
  calcularEstadisticasVentas: jest.fn(),
}));

const PresupuestoMarketing = require("../../models/Marketing/PresupuestoMarketing");
const GastoMarketing = require("../../models/Marketing/GastoMarketing");
const Entrega = require("../../models/Entrega");
const auditoriaVentasController = require("../Auditoria/auditoriaVentasController");
const {
  calcularEstadisticasVentas,
} = require("../../utils/calcularEstadisticasVentas");
const {
  obtenerReporteCostoEntrega,
  obtenerReporteCostoEntregaTotal,
  obtenerReporteCostoVenta,
  resolverSemanaOperativa,
} = require("./costoVentaMarketingController");

const crearRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn(),
});

describe("costoVentaMarketingController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("normaliza cualquier fecha a semana operativa de jueves a miercoles", () => {
    expect(resolverSemanaOperativa({ fechaInicio: "2026-06-17" })).toEqual({
      fechaInicio: "2026-06-11",
      fechaFin: "2026-06-17",
      mes: 6,
      anio: 2026,
    });
  });

  test("calcula reporte excedido con costo por venta semanal", async () => {
    PresupuestoMarketing.findOne.mockResolvedValue({
      presupuestoAsignado: 900,
      metaVentas: 100,
    });
    GastoMarketing.sum.mockResolvedValue(1000);
    auditoriaVentasController.obtenerReporteGerencia.mockResolvedValue([
      { id: 1 },
    ]);
    auditoriaVentasController.formatearReporte.mockReturnValue([
      { id: 1 },
    ]);
    calcularEstadisticasVentas.mockReturnValue({ totalVentas: 100 });

    const req = {
      query: {
        fechaInicio: "2026-06-11",
      },
    };
    const res = crearRes();

    await obtenerReporteCostoVenta(req, res);

    expect(auditoriaVentasController.obtenerReporteGerencia).toHaveBeenCalledWith({
      fechaInicio: "2026-06-11",
      fechaFin: "2026-06-17",
    });
    expect(auditoriaVentasController.formatearReporte).toHaveBeenCalledWith([
      { id: 1 },
    ]);
    expect(calcularEstadisticasVentas).toHaveBeenCalledWith([{ id: 1 }], "2026-06-11");
    expect(res.json).toHaveBeenCalledWith({
      fechaInicio: "2026-06-11",
      fechaFin: "2026-06-17",
      presupuestoAsignado: 900,
      gastoReal: 1000,
      diferencia: -100,
      porcentajeEjecucion: 111.11,
      ventasRealizadas: 100,
      costoPorVentaReal: 10,
      costoPorVentaObjetivo: 9,
      diferenciaPorVenta: 1,
      estado: "EXCEDIDO",
    });
  });

  test("devuelve cero cuando presupuesto, ventas o meta son cero", async () => {
    PresupuestoMarketing.findOne.mockResolvedValue({
      presupuestoAsignado: 0,
      metaVentas: 0,
    });
    GastoMarketing.sum.mockResolvedValue(0);
    auditoriaVentasController.obtenerReporteGerencia.mockResolvedValue([]);
    auditoriaVentasController.formatearReporte.mockReturnValue([]);
    calcularEstadisticasVentas.mockReturnValue({ totalVentas: 0 });

    const req = {
      query: {
        fechaInicio: "2026-06-11",
      },
    };
    const res = crearRes();

    await obtenerReporteCostoVenta(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        porcentajeEjecucion: 0,
        costoPorVentaReal: 0,
        costoPorVentaObjetivo: 0,
        diferenciaPorVenta: 0,
        estado: "DENTRO_PRESUPUESTO",
      }),
    );
  });

  test("marca SIN_DATOS cuando no existe presupuesto activo", async () => {
    PresupuestoMarketing.findOne.mockResolvedValue(null);
    GastoMarketing.sum.mockResolvedValue(25);
    auditoriaVentasController.obtenerReporteGerencia.mockResolvedValue([]);
    auditoriaVentasController.formatearReporte.mockReturnValue([]);
    calcularEstadisticasVentas.mockReturnValue({ totalVentas: 0 });

    const req = {
      query: {
        fechaInicio: "2026-06-11",
      },
    };
    const res = crearRes();

    await obtenerReporteCostoVenta(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        presupuestoAsignado: 0,
        gastoReal: 25,
        estado: "SIN_DATOS",
      }),
    );
  });

  test("calcula reporte con costo por entrega semanal", async () => {
    PresupuestoMarketing.findOne.mockResolvedValue({
      presupuestoAsignado: 900,
      metaVentas: 30,
    });
    GastoMarketing.sum.mockResolvedValue(600);
    Entrega.count.mockResolvedValue(3);

    const req = {
      query: {
        fechaInicio: "2026-06-11",
      },
    };
    const res = crearRes();

    await obtenerReporteCostoEntrega(req, res);

    expect(PresupuestoMarketing.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tipoModulo: "ENTREGAS",
        }),
      }),
    );
    expect(GastoMarketing.sum).toHaveBeenCalledWith(
      "monto",
      expect.objectContaining({
        where: expect.objectContaining({
          tipoModulo: "ENTREGAS",
        }),
      }),
    );
    expect(Entrega.count).toHaveBeenCalledWith({
      where: {
        estado: "Entregado",
        fecha: expect.any(Object),
      },
    });
    expect(res.json).toHaveBeenCalledWith({
      fechaInicio: "2026-06-11",
      fechaFin: "2026-06-17",
      presupuestoAsignado: 900,
      gastoReal: 600,
      diferencia: 300,
      porcentajeEjecucion: 66.67,
      entregasRealizadas: 3,
      metaEntregas: 30,
      costoPorEntregaReal: 200,
      costoPorEntregaObjetivo: 30,
      diferenciaPorEntrega: 170,
      estado: "DENTRO_PRESUPUESTO",
    });
  });

  test("calcula costo por entrega total para un rango exacto", async () => {
    GastoMarketing.sum.mockResolvedValue(1200);
    Entrega.count.mockResolvedValue(6);

    const req = {
      query: {
        fechaInicio: "2026-06-01",
        fechaFin: "2026-06-30",
      },
    };
    const res = crearRes();

    await obtenerReporteCostoEntregaTotal(req, res);

    expect(GastoMarketing.sum).toHaveBeenCalledWith(
      "monto",
      expect.objectContaining({
        where: expect.objectContaining({
          tipoModulo: "ENTREGAS",
          fecha: expect.any(Object),
        }),
      }),
    );
    expect(Entrega.count).toHaveBeenCalledWith({
      where: {
        estado: "Entregado",
        fecha: expect.any(Object),
      },
    });
    expect(res.json).toHaveBeenCalledWith({
      fechaInicio: "2026-06-01",
      fechaFin: "2026-06-30",
      gastoReal: 1200,
      entregasRealizadas: 6,
      costoPorEntregaTotal: 200,
    });
  });
});
