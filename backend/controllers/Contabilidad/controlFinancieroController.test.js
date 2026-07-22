jest.mock("../../models/ControlFinancieroCarga", () => ({
  findAll: jest.fn(),
  findAndCountAll: jest.fn(),
  findByPk: jest.fn(),
}));

jest.mock("../../models/ControlFinancieroRegistro", () => ({
  findAll: jest.fn(),
}));

jest.mock("../../models/Usuario", () => ({}));

jest.mock("../../config/db", () => ({
  sequelize: {
    transaction: jest.fn(),
  },
}));

const ControlFinancieroCarga = require("../../models/ControlFinancieroCarga");
const ControlFinancieroRegistro = require("../../models/ControlFinancieroRegistro");
const { Op } = require("sequelize");
const { sequelize } = require("../../config/db");
const controller = require("./controlFinancieroController");

const crearRes = () => {
  const res = {
    status: jest.fn(),
    json: jest.fn(),
  };
  res.status.mockReturnValue(res);
  return res;
};

describe("controlFinancieroController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sequelize.transaction.mockImplementation(async (callback) =>
      callback({ id: "transaction", LOCK: { UPDATE: "UPDATE" } }),
    );
  });

  test("lista solo cargas activas por defecto", async () => {
    ControlFinancieroCarga.findAndCountAll.mockResolvedValue({
      rows: [],
      count: 0,
    });
    const res = crearRes();

    await controller.listarCargas({ query: {} }, res);

    expect(ControlFinancieroCarga.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({ where: { estado: "ACTIVA" } }),
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ ok: true, cargas: [] }),
    );
  });

  test("permite incluir cargas anuladas en el historial", async () => {
    ControlFinancieroCarga.findAndCountAll.mockResolvedValue({
      rows: [],
      count: 0,
    });
    const res = crearRes();

    await controller.listarCargas({ query: { estado: "TODAS" } }, res);

    expect(ControlFinancieroCarga.findAndCountAll).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
  });

  test("consolida TV y celular de todas las cargas activas sin incluir cuotas", async () => {
    ControlFinancieroCarga.findAll.mockResolvedValue([
      {
        id: 8,
        registrosVentasTv: 2,
        registrosVentasCelular: 1,
        totalVentasTv: "500.00",
        totalEntradasTv: "50.00",
        totalVentasCelular: "300.00",
        totalEntradasCelular: "30.00",
      },
      {
        id: 7,
        registrosVentasTv: 1,
        registrosVentasCelular: 2,
        totalVentasTv: "250.00",
        totalEntradasTv: "25.00",
        totalVentasCelular: "600.00",
        totalEntradasCelular: "60.00",
      },
    ]);
    ControlFinancieroRegistro.findAll.mockResolvedValue([
      {
        get: () => ({ id: 1, cargaId: 8, tipoRegistro: "VENTA_TV" }),
      },
      {
        get: () => ({ id: 2, cargaId: 7, tipoRegistro: "VENTA_CELULAR" }),
      },
    ]);
    const res = crearRes();

    await controller.consolidarVentas(
      { query: { fechaInicio: "2026-07-01", fechaFin: "2026-07-31" } },
      res,
    );

    expect(ControlFinancieroCarga.findAll.mock.calls[0][0].where).toEqual(
      expect.objectContaining({
        estado: "ACTIVA",
        fechaReporte: expect.any(Object),
      }),
    );
    const whereRegistros = ControlFinancieroRegistro.findAll.mock.calls[0][0].where;
    expect(whereRegistros.cargaId[Op.in]).toEqual([8, 7]);
    expect(whereRegistros.tipoRegistro[Op.in]).toEqual([
      "VENTA_TV",
      "VENTA_CELULAR",
    ]);
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      resumen: {
        cargas: 2,
        registrosVentasTv: 3,
        registrosVentasCelular: 3,
        totalVentasTv: 750,
        totalEntradasTv: 75,
        totalVentasCelular: 900,
        totalEntradasCelular: 90,
      },
      registros: {
        ventasTv: [expect.objectContaining({ tipoRegistro: "VENTA_TV" })],
        ventasCelular: [
          expect.objectContaining({ tipoRegistro: "VENTA_CELULAR" }),
        ],
      },
    });
  });

  test("devuelve un consolidado vacio cuando no existen cargas activas", async () => {
    ControlFinancieroCarga.findAll.mockResolvedValue([]);
    const res = crearRes();

    await controller.consolidarVentas({ query: {} }, res);

    expect(ControlFinancieroRegistro.findAll).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        resumen: expect.objectContaining({ cargas: 0, totalVentasTv: 0 }),
        registros: { ventasTv: [], ventasCelular: [] },
      }),
    );
  });

  test("devuelve el detalle agrupado por caja, TV y celular", async () => {
    ControlFinancieroCarga.findByPk.mockResolvedValue({
      get: () => ({
        id: 5,
        estado: "ANULADA",
        motivoAnulacion: "Carga duplicada",
        archivoGenerado: "CIERRE.xlsx",
        totalPagosCaja: "10.50",
        totalVentasTv: "300.00",
        totalEntradasTv: "30.00",
        totalVentasCelular: "250.00",
        totalEntradasCelular: "20.00",
      }),
    });
    ControlFinancieroRegistro.findAll.mockResolvedValue(
      ["CAJA", "VENTA_TV", "VENTA_CELULAR"].map((tipoRegistro, index) => ({
        get: () => ({
          id: index + 1,
          tipoRegistro,
          pagosCuotas: tipoRegistro === "CAJA" ? "10.50" : "0.00",
          ventas: tipoRegistro === "CAJA" ? "0.00" : "100.00",
          entradas: tipoRegistro === "CAJA" ? "0.00" : "10.00",
        }),
      })),
    );
    const res = crearRes();

    await controller.obtenerCarga({ params: { id: "5" } }, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        carga: expect.objectContaining({
          estado: "ANULADA",
          motivoAnulacion: "Carga duplicada",
          totalPagosCaja: 10.5,
        }),
        registros: expect.objectContaining({
          caja: [expect.objectContaining({ tipoRegistro: "CAJA" })],
          ventasTv: [expect.objectContaining({ tipoRegistro: "VENTA_TV" })],
          ventasCelular: [
            expect.objectContaining({ tipoRegistro: "VENTA_CELULAR" }),
          ],
        }),
      }),
    );
  });

  test("rechaza un identificador de carga invalido", async () => {
    const res = crearRes();

    await controller.obtenerCarga({ params: { id: "abc" } }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(ControlFinancieroCarga.findByPk).not.toHaveBeenCalled();
  });

  test("anula una carga sin eliminar sus registros", async () => {
    const carga = {
      id: 5,
      estado: "ACTIVA",
      update: jest.fn().mockImplementation(async function actualizar(payload) {
        Object.assign(this, payload);
      }),
    };
    ControlFinancieroCarga.findByPk.mockResolvedValue(carga);
    const res = crearRes();

    await controller.anularCarga(
      {
        params: { id: "5" },
        body: { motivo: "El reporte cargado no corresponde a la agencia." },
        user: { id: 7 },
      },
      res,
    );

    expect(ControlFinancieroCarga.findByPk).toHaveBeenCalledWith(
      5,
      expect.objectContaining({
        transaction: expect.any(Object),
        lock: "UPDATE",
      }),
    );
    expect(carga.update).toHaveBeenCalledWith(
      expect.objectContaining({
        estado: "ANULADA",
        motivoAnulacion:
          "El reporte cargado no corresponde a la agencia.",
        anuladoPor: 7,
        anuladoEn: expect.any(Date),
      }),
      expect.objectContaining({ transaction: expect.any(Object) }),
    );
    expect(ControlFinancieroRegistro.findAll).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        message: "La carga fue anulada y sus registros se conservaron.",
        carga: expect.objectContaining({ id: 5, estado: "ANULADA" }),
      }),
    );
  });

  test("exige un motivo antes de anular", async () => {
    const res = crearRes();

    await controller.anularCarga(
      { params: { id: "5" }, body: { motivo: "  " }, user: { id: 7 } },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(sequelize.transaction).not.toHaveBeenCalled();
    expect(ControlFinancieroCarga.findByPk).not.toHaveBeenCalled();
  });

  test("impide volver a anular una carga que ya no esta activa", async () => {
    const carga = { id: 5, estado: "ANULADA", update: jest.fn() };
    ControlFinancieroCarga.findByPk.mockResolvedValue(carga);
    const res = crearRes();

    await controller.anularCarga(
      { params: { id: "5" }, body: { motivo: "Duplicada" }, user: { id: 7 } },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(409);
    expect(carga.update).not.toHaveBeenCalled();
  });

  test("responde 404 al anular una carga inexistente", async () => {
    ControlFinancieroCarga.findByPk.mockResolvedValue(null);
    const res = crearRes();

    await controller.anularCarga(
      { params: { id: "99" }, body: { motivo: "Duplicada" }, user: { id: 7 } },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(404);
  });
});
