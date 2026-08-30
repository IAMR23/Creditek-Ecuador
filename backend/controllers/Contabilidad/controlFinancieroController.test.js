jest.mock("../../models/ControlFinancieroCarga", () => ({
  findAll: jest.fn(),
  findAndCountAll: jest.fn(),
  findByPk: jest.fn(),
}));

jest.mock("../../models/ControlFinancieroRegistro", () => ({
  findAll: jest.fn(),
  findByPk: jest.fn(),
}));

jest.mock("../../models/Usuario", () => ({
  findAll: jest.fn(),
  findOne: jest.fn(),
}));

jest.mock("../../config/db", () => ({
  sequelize: {
    transaction: jest.fn(),
  },
}));

jest.mock("../../services/conciliacionEntradasService", () => ({
  conciliarCarga: jest.fn(),
  confirmarCoincidenciaManual: jest.fn(),
  obtenerConciliacionCarga: jest.fn(),
}));

jest.mock("../../services/conciliacionCuotasCajaService", () => ({
  conciliarCargaCaja: jest.fn(),
  listarHistorialConciliacionCaja: jest.fn(),
  obtenerConciliacionCajaCarga: jest.fn(),
}));

const ControlFinancieroCarga = require("../../models/ControlFinancieroCarga");
const ControlFinancieroRegistro = require("../../models/ControlFinancieroRegistro");
const Usuario = require("../../models/Usuario");
const { Op } = require("sequelize");
const { sequelize } = require("../../config/db");
const {
  conciliarCarga,
  confirmarCoincidenciaManual,
  obtenerConciliacionCarga,
} = require("../../services/conciliacionEntradasService");
const {
  conciliarCargaCaja,
  listarHistorialConciliacionCaja,
  obtenerConciliacionCajaCarga,
} = require("../../services/conciliacionCuotasCajaService");
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

  test("calcula cobertura diaria usando solo cargas activas", async () => {
    ControlFinancieroCarga.findAll.mockResolvedValue([
      {
        estado: "ACTIVA",
        fechaReporte: "2026-08-01",
        registrosVentasTv: 4,
        registrosVentasCelular: 2,
      },
      {
        estado: "ACTIVA",
        fechaReporte: "2026-08-02",
        registrosVentasTv: 0,
        registrosVentasCelular: 3,
      },
    ]);
    const res = crearRes();

    await controller.obtenerCoberturaReportes(
      { query: { fechaInicio: "2026-08-01", fechaFin: "2026-08-03" } },
      res,
    );

    const consulta = ControlFinancieroCarga.findAll.mock.calls[0][0];
    expect(consulta.where.estado).toBe("ACTIVA");
    expect(consulta.where.fechaReporte[Op.between]).toEqual([
      "2026-08-01",
      "2026-08-03",
    ]);
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      cobertura: expect.objectContaining({
        resumen: {
          diasCompletos: 1,
          diasFaltaTv: 2,
          diasFaltaCelular: 1,
          diasSinReportes: 1,
          diasConPendientes: 2,
        },
        dias: expect.arrayContaining([
          expect.objectContaining({
            fecha: "2026-08-02",
            estado: "FALTA_TV",
          }),
          expect.objectContaining({
            fecha: "2026-08-03",
            estado: "SIN_REPORTES",
          }),
        ]),
      }),
    });
  });

  test("rechaza cobertura con fechas futuras", async () => {
    const res = crearRes();

    await controller.obtenerCoberturaReportes(
      { query: { fechaInicio: "2099-01-01", fechaFin: "2099-01-02" } },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(ControlFinancieroCarga.findAll).not.toHaveBeenCalled();
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

  test("lista solo usuarios activos como responsables de pago", async () => {
    Usuario.findAll.mockResolvedValue([{ id: 2, nombre: "Ana" }]);
    const res = crearRes();

    await controller.listarResponsablesPagoEntrada({}, res);

    expect(Usuario.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ where: { activo: true } }),
    );
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      usuarios: [{ id: 2, nombre: "Ana" }],
    });
  });

  test("guarda estado, responsable y observacion de una entrada", async () => {
    const registro = {
      id: 21,
      cargaId: 5,
      tipoRegistro: "VENTA_TV",
      entradas: "50.00",
      update: jest.fn().mockImplementation(async function actualizar(payload) {
        Object.assign(this, payload);
      }),
    };
    ControlFinancieroRegistro.findByPk.mockResolvedValue(registro);
    ControlFinancieroCarga.findByPk.mockResolvedValue({ id: 5, estado: "ACTIVA" });
    Usuario.findOne.mockResolvedValue({ id: 8, nombre: "Maria", activo: true });
    const res = crearRes();

    await controller.actualizarPagoEntrada(
      {
        params: { registroId: "21" },
        body: {
          estado: "pagado",
          responsableUsuarioId: 8,
          observacion: "Transferencia verificada",
        },
      },
      res,
    );

    expect(ControlFinancieroRegistro.findByPk).toHaveBeenCalledWith(
      21,
      expect.objectContaining({ lock: "UPDATE" }),
    );
    expect(Usuario.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 8, activo: true } }),
    );
    expect(registro.update).toHaveBeenCalledWith(
      {
        estadoPagoEntrada: "PAGADO",
        responsablePagoEntradaId: 8,
        observacionPagoEntrada: "Transferencia verificada",
      },
      expect.objectContaining({ transaction: expect.any(Object) }),
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        registro: expect.objectContaining({
          id: 21,
          estadoPagoEntrada: "PAGADO",
          responsablePagoEntrada: expect.objectContaining({ id: 8 }),
        }),
      }),
    );
  });

  test("no permite gestionar un registro sin valor de entrada", async () => {
    ControlFinancieroRegistro.findByPk.mockResolvedValue({
      id: 21,
      cargaId: 5,
      tipoRegistro: "VENTA_CELULAR",
      entradas: "0.00",
    });
    const res = crearRes();

    await controller.actualizarPagoEntrada(
      {
        params: { registroId: "21" },
        body: { estado: "PENDIENTE", responsableUsuarioId: 8 },
      },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Usuario.findOne).not.toHaveBeenCalled();
  });

  test("rechaza responsables inactivos", async () => {
    ControlFinancieroRegistro.findByPk.mockResolvedValue({
      id: 21,
      cargaId: 5,
      tipoRegistro: "VENTA_CELULAR",
      entradas: "25.00",
    });
    ControlFinancieroCarga.findByPk.mockResolvedValue({ id: 5, estado: "ACTIVA" });
    Usuario.findOne.mockResolvedValue(null);
    const res = crearRes();

    await controller.actualizarPagoEntrada(
      {
        params: { registroId: "21" },
        body: { estado: "PENDIENTE", responsableUsuarioId: 8 },
      },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("inactivo") }),
    );
  });

  test("guarda responsable y observacion de caja no en cierre", async () => {
    const registro = {
      id: 31,
      cargaId: 6,
      tipoRegistro: "CAJA",
      pagosCuotas: "14.00",
      estadoPagoEntrada: "PENDIENTE",
      update: jest.fn().mockImplementation(async function actualizar(payload) {
        Object.assign(this, payload);
      }),
    };
    ControlFinancieroRegistro.findByPk.mockResolvedValue(registro);
    ControlFinancieroCarga.findByPk.mockResolvedValue({ id: 6, estado: "ACTIVA" });
    obtenerConciliacionCajaCarga.mockResolvedValue({
      carga: { id: 6, estado: "ACTIVA" },
      conciliacion: {
        id: "20",
        resultados: [
          {
            controlFinancieroRegistroId: 31,
            estado: "NO_EN_CIERRE",
          },
        ],
      },
    });
    Usuario.findOne.mockResolvedValue({ id: 8, nombre: "Maria", activo: true });
    const res = crearRes();

    await controller.actualizarGestionCajaNoEnCierre(
      {
        params: { registroId: "31" },
        body: {
          responsableUsuarioId: 8,
          observacion: "Pago reportado sin cierre",
        },
      },
      res,
    );

    expect(registro.update).toHaveBeenCalledWith(
      {
        estadoPagoEntrada: "PENDIENTE",
        responsablePagoEntradaId: 8,
        observacionPagoEntrada: "Pago reportado sin cierre",
      },
      expect.objectContaining({ transaction: expect.any(Object) }),
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        registro: expect.objectContaining({
          id: 31,
          responsablePagoEntradaId: 8,
          responsablePagoEntrada: expect.objectContaining({ id: 8 }),
        }),
      }),
    );
  });

  test("rechaza gestionar caja si la ultima conciliacion ya no esta no en cierre", async () => {
    ControlFinancieroRegistro.findByPk.mockResolvedValue({
      id: 31,
      cargaId: 6,
      tipoRegistro: "CAJA",
      pagosCuotas: "14.00",
    });
    ControlFinancieroCarga.findByPk.mockResolvedValue({ id: 6, estado: "ACTIVA" });
    obtenerConciliacionCajaCarga.mockResolvedValue({
      carga: { id: 6, estado: "ACTIVA" },
      conciliacion: {
        id: "20",
        resultados: [
          {
            controlFinancieroRegistroId: 31,
            estado: "COINCIDE",
          },
        ],
      },
    });
    const res = crearRes();

    await controller.actualizarGestionCajaNoEnCierre(
      {
        params: { registroId: "31" },
        body: { responsableUsuarioId: 8 },
      },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(409);
    expect(Usuario.findOne).not.toHaveBeenCalled();
  });

  test("devuelve la ultima conciliacion historica de la carga", async () => {
    obtenerConciliacionCarga.mockResolvedValue({
      carga: { id: 5, fechaReporte: "2026-07-22", estado: "ACTIVA" },
      conciliacion: {
        id: "12",
        resumen: { cuadrados: 1 },
        resultados: [],
      },
    });
    const res = crearRes();

    await controller.obtenerConciliacionEntradas(
      { params: { cargaId: "5" } },
      res,
    );

    expect(obtenerConciliacionCarga).toHaveBeenCalledWith("5");
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        conciliacion: expect.objectContaining({ id: "12" }),
      }),
    );
  });

  test("permite ejecutar nuevamente la conciliacion", async () => {
    conciliarCarga.mockResolvedValue({ id: "13", resultados: [] });
    const res = crearRes();

    await controller.reconciliarEntradas(
      { params: { cargaId: "5" }, user: { id: 7 } },
      res,
    );

    expect(conciliarCarga).toHaveBeenCalledWith({
      cargaId: "5",
      origen: "MANUAL",
      usuarioId: 7,
    });
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ ok: true }),
    );
  });

  test("devuelve y reejecuta la conciliacion historica de caja", async () => {
    obtenerConciliacionCajaCarga.mockResolvedValue({
      carga: { id: 5, fechaReporte: "2026-08-25", estado: "ACTIVA" },
      conciliacion: { id: "90", resultados: [], resumen: { coinciden: 1 } },
    });
    conciliarCargaCaja.mockResolvedValue({ id: "91", resultados: [] });
    const resGet = crearRes();
    const resPost = crearRes();

    await controller.obtenerConciliacionCaja(
      { params: { cargaId: "5" } },
      resGet,
    );
    await controller.reconciliarCaja(
      { params: { cargaId: "5" }, user: { id: 7 } },
      resPost,
    );

    expect(obtenerConciliacionCajaCarga).toHaveBeenCalledWith("5");
    expect(conciliarCargaCaja).toHaveBeenCalledWith({
      cargaId: "5",
      origen: "MANUAL",
      usuarioId: 7,
    });
    expect(resGet.json).toHaveBeenCalledWith(
      expect.objectContaining({ ok: true, conciliacion: { id: "90", resultados: [], resumen: { coinciden: 1 } } }),
    );
    expect(resPost.json).toHaveBeenCalledWith(
      expect.objectContaining({ ok: true }),
    );
  });

  test("lista ejecuciones historicas de conciliacion de caja", async () => {
    listarHistorialConciliacionCaja.mockResolvedValue([{ id: "91" }]);
    const res = crearRes();

    await controller.obtenerHistorialConciliacionCaja(
      { params: { cargaId: "5" }, query: { limite: "10" } },
      res,
    );

    expect(listarHistorialConciliacionCaja).toHaveBeenCalledWith("5", "10");
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      ejecuciones: [{ id: "91" }],
    });
  });

  test("confirma una coincidencia manual sin modificar movimientos", async () => {
    confirmarCoincidenciaManual.mockResolvedValue({
      id: "14",
      resultados: [],
    });
    const res = crearRes();

    await controller.confirmarConciliacionEntrada(
      {
        params: { cargaId: "5", resultadoId: "resultado-1" },
        body: {
          clienteControlNormalizado: "SEGUNDO FRANCISCO CANDO LOJA",
          observacion: "Contrato verificado",
        },
        user: { id: 7 },
      },
      res,
    );

    expect(confirmarCoincidenciaManual).toHaveBeenCalledWith({
      cargaId: "5",
      resultadoId: "resultado-1",
      clienteControlNormalizado: "SEGUNDO FRANCISCO CANDO LOJA",
      observacion: "Contrato verificado",
      usuarioId: 7,
    });
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ ok: true }),
    );
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
