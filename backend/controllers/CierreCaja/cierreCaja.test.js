jest.mock("../../config/db", () => ({
  sequelize: {
    transaction: jest.fn(),
  },
}));

jest.mock("../../models/CierreCaja/CierreCaja", () => ({
  findOne: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
  create: jest.fn(),
}));

jest.mock("../../models/CierreCaja/MovimientoCaja", () => ({
  findAll: jest.fn(),
  bulkCreate: jest.fn(),
  destroy: jest.fn(),
}));

jest.mock("../../models/CierreCaja/MovimientoCajaTemp", () => ({
  findAll: jest.fn(),
  destroy: jest.fn(),
}));

jest.mock("../../models/CierreCaja/Denominacion", () => ({
  findAll: jest.fn(),
  bulkCreate: jest.fn(),
  destroy: jest.fn(),
}));

jest.mock("../../models/CierreCaja/RetiroCaja", () => ({
  findAll: jest.fn(),
  bulkCreate: jest.fn(),
  destroy: jest.fn(),
}));

jest.mock("../../models/CierreCaja/ReaperturaCierreCaja", () => ({
  findAll: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
}));

jest.mock("../../models/UsuarioAgencia", () => ({
  findAll: jest.fn(),
  findOne: jest.fn(),
}));

jest.mock("../../models/Usuario", () => ({}));
jest.mock("../../models/Agencia", () => ({}));

jest.mock("../../services/conciliacionEntradasService", () => ({
  conciliarCargasPorFecha: jest.fn(),
}));

jest.mock("../../services/conciliacionCuotasCajaService", () => ({
  conciliarCargasCajaPorFecha: jest.fn(),
}));

jest.mock("./DenominacionCajaTemp", () => ({
  crearHistorialDenominaciones: jest.fn(),
  limpiarDenominacionesTemp: jest.fn(),
  obtenerDenominacionesTempParaCierre: jest.fn(),
}));

const { sequelize } = require("../../config/db");
const CierreCaja = require("../../models/CierreCaja/CierreCaja");
const MovimientoCaja = require("../../models/CierreCaja/MovimientoCaja");
const MovimientoCajaTemp = require("../../models/CierreCaja/MovimientoCajaTemp");
const Denominacion = require("../../models/CierreCaja/Denominacion");
const RetiroCaja = require("../../models/CierreCaja/RetiroCaja");
const ReaperturaCierreCaja = require("../../models/CierreCaja/ReaperturaCierreCaja");
const UsuarioAgencia = require("../../models/UsuarioAgencia");
const {
  conciliarCargasPorFecha,
} = require("../../services/conciliacionEntradasService");
const {
  conciliarCargasCajaPorFecha,
} = require("../../services/conciliacionCuotasCajaService");
const {
  crearHistorialDenominaciones,
  limpiarDenominacionesTemp,
  obtenerDenominacionesTempParaCierre,
} = require("./DenominacionCajaTemp");
const {
  cerrarCaja,
  obtenerTodosLosCierresCaja,
  reabrirCierreCaja,
  actualizarCierreCajaReabierto,
} = require("./cierreCaja");

const crearRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

const crearTransaccion = () => ({
  commit: jest.fn(),
  rollback: jest.fn(),
  LOCK: { UPDATE: "UPDATE" },
});

const esperarTareasEnSegundoPlano = () =>
  new Promise((resolve) => setImmediate(resolve));

const crearCierre = (overrides = {}) => ({
  id: 1,
  fecha: "2026-06-12",
  usuarioId: 7,
  usuarioAgenciaId: 11,
  estadoCierre: "CERRADO",
  update: jest.fn().mockResolvedValue(undefined),
  toJSON: jest.fn(() => ({ id: 1, estadoCierre: "CERRADO", ...overrides })),
  ...overrides,
});

describe("cierreCaja controller", () => {
  let transaction;

  beforeEach(() => {
    jest.clearAllMocks();
    transaction = crearTransaccion();
    sequelize.transaction.mockResolvedValue(transaction);
    Denominacion.findAll.mockResolvedValue([]);
    RetiroCaja.findAll.mockResolvedValue([]);
    MovimientoCaja.findAll.mockResolvedValue([]);
    ReaperturaCierreCaja.findAll.mockResolvedValue([]);
    UsuarioAgencia.findOne.mockResolvedValue({ id: 11, agenciaId: 3 });
    crearHistorialDenominaciones.mockResolvedValue(undefined);
    limpiarDenominacionesTemp.mockResolvedValue(undefined);
    obtenerDenominacionesTempParaCierre.mockResolvedValue([]);
    conciliarCargasPorFecha.mockResolvedValue({
      fecha: "2026-06-12",
      cargasProcesadas: 0,
      conciliaciones: [],
    });
    conciliarCargasCajaPorFecha.mockResolvedValue({
      fecha: "2026-06-12",
      cargasProcesadas: 0,
      conciliaciones: [],
    });
  });

  afterEach(async () => {
    await esperarTareasEnSegundoPlano();
  });

  test("crea un cierre exitoso y limpia temporales del usuario-agencia", async () => {
    CierreCaja.findOne.mockResolvedValue(null);
    MovimientoCajaTemp.findAll.mockResolvedValue([
      {
        responsable: "Ana",
        detalle: "CUOTA",
        entidad: null,
        valor: "10.00",
        formaPago: "EFECTIVO",
        recibo: "1",
        observacion: "",
      },
    ]);
    CierreCaja.create.mockResolvedValue({ id: 99 });
    Denominacion.bulkCreate.mockResolvedValue([]);
    MovimientoCaja.bulkCreate.mockResolvedValue([]);
    MovimientoCajaTemp.destroy.mockResolvedValue(1);

    const req = {
      user: { id: 7, usuarioAgenciaId: 11, agenciaId: 3 },
      body: {
        denominaciones: [{ denominacion: 10, cantidad: 1 }],
        retiros: [],
        movimientosPendientes: [],
      },
    };
    const res = crearRes();

    await cerrarCaja(req, res);
    await esperarTareasEnSegundoPlano();

    expect(CierreCaja.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ usuarioId: 7 }),
      }),
    );
    expect(CierreCaja.create).toHaveBeenCalledWith(
      expect.objectContaining({
        usuarioId: 7,
        usuarioAgenciaId: 11,
        agenciaId: 3,
        usuarioCreacion: "7",
        usuarioModificacion: "7",
        fechaCreacion: expect.any(Date),
        fechaModificacion: expect.any(Date),
        totalFisico: 10,
        totalEfectivo: 10,
        estado: "CUADRADO",
        estadoCierre: "CERRADO",
      }),
      { transaction },
    );
    expect(MovimientoCajaTemp.destroy).toHaveBeenCalledWith({
      where: { usuarioAgenciaId: 11, estado: "ACTIVO" },
      transaction,
    });
    expect(transaction.commit).toHaveBeenCalled();
    expect(conciliarCargasPorFecha).toHaveBeenCalledWith(
      expect.objectContaining({ origen: "CIERRE", usuarioId: 7 }),
    );
    expect(conciliarCargasCajaPorFecha).toHaveBeenCalledWith(
      expect.objectContaining({ origen: "CIERRE", usuarioId: 7 }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        conciliacionEntradas: expect.objectContaining({
          fecha: expect.any(String),
          pendiente: true,
          estado: "PENDIENTE",
        }),
        conciliacionCaja: expect.objectContaining({
          fecha: expect.any(String),
          pendiente: true,
          estado: "PENDIENTE",
        }),
      }),
    );
  });

  test("usa el snapshot completo como fuente autoritativa sin mezclar temporales", async () => {
    CierreCaja.findOne.mockResolvedValue(null);
    MovimientoCajaTemp.findAll.mockResolvedValue([
      {
        responsable: "Temporal",
        detalle: "CUOTA",
        valor: "99.00",
        formaPago: "EFECTIVO",
      },
    ]);
    CierreCaja.create.mockResolvedValue({ id: 120 });
    MovimientoCaja.bulkCreate.mockResolvedValue([]);
    MovimientoCajaTemp.destroy.mockResolvedValue(1);

    const req = {
      user: { id: 7, usuarioAgenciaId: 11, agenciaId: 3 },
      body: {
        movimientos: [
          {
            responsable: "Ana",
            detalle: "CUOTA",
            entidad: "0102030405 - ANA PEREZ",
            clienteId: 42,
            valor: "10.15",
            formaPago: "efectivo",
          },
          {
            responsable: "Luis",
            detalle: "ENTRADA",
            valor: 20,
            formaPago: "TRANSFERENCIA",
          },
        ],
        movimientosPendientes: [
          {
            responsable: "Pendiente antiguo",
            detalle: "CONTADO",
            valor: 50,
            formaPago: "EFECTIVO",
          },
        ],
        denominaciones: [],
        retiros: [],
      },
    };
    const res = crearRes();

    await cerrarCaja(req, res);

    expect(MovimientoCajaTemp.findAll).not.toHaveBeenCalled();
    expect(MovimientoCaja.bulkCreate).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          cierreId: 120,
          responsable: "Ana",
          detalle: "CUOTA",
          entidad: "0102030405 - ANA PEREZ",
          clienteId: 42,
          valor: 10.15,
          formaPago: "EFECTIVO",
        }),
        expect.objectContaining({
          cierreId: 120,
          responsable: "Luis",
          detalle: "ENTRADA",
          valor: 20,
          formaPago: "TRANSFERENCIA",
        }),
      ],
      { transaction },
    );
    expect(CierreCaja.create).toHaveBeenCalledWith(
      expect.objectContaining({
        totalEfectivo: 10.15,
        totalTransferencia: 20,
        totalSistema: 30.15,
      }),
      { transaction },
    );
    expect(MovimientoCajaTemp.destroy).toHaveBeenCalledWith({
      where: { usuarioAgenciaId: 11, estado: "ACTIVO" },
      transaction,
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ totalMovimientos: 2 }),
    );
  });

  test("un snapshot vacio no recurre a movimientos temporales", async () => {
    CierreCaja.findOne.mockResolvedValue(null);
    MovimientoCajaTemp.findAll.mockResolvedValue([
      {
        responsable: "Temporal",
        detalle: "CUOTA",
        valor: "10.00",
        formaPago: "EFECTIVO",
      },
    ]);

    const req = {
      user: { id: 7, usuarioAgenciaId: 11, agenciaId: 3 },
      body: { movimientos: [], denominaciones: [], retiros: [] },
    };
    const res = crearRes();

    await cerrarCaja(req, res);

    expect(MovimientoCajaTemp.findAll).not.toHaveBeenCalled();
    expect(CierreCaja.create).not.toHaveBeenCalled();
    expect(MovimientoCajaTemp.destroy).not.toHaveBeenCalled();
    expect(transaction.rollback).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "No existen movimientos validos para cerrar caja",
    });
  });

  test("rechaza el snapshot completo si contiene un movimiento invalido", async () => {
    MovimientoCajaTemp.findAll.mockResolvedValue([
      {
        responsable: "Temporal conservado",
        detalle: "CUOTA",
        valor: "10.00",
        formaPago: "EFECTIVO",
      },
    ]);

    const req = {
      user: { id: 7, usuarioAgenciaId: 11, agenciaId: 3 },
      body: {
        movimientos: [
          {
            responsable: "Ana",
            detalle: "CUOTA",
            valor: 10,
            formaPago: "CHEQUE",
          },
        ],
      },
    };
    const res = crearRes();

    await cerrarCaja(req, res);

    expect(MovimientoCajaTemp.findAll).not.toHaveBeenCalled();
    expect(CierreCaja.findOne).not.toHaveBeenCalled();
    expect(CierreCaja.create).not.toHaveBeenCalled();
    expect(MovimientoCajaTemp.destroy).not.toHaveBeenCalled();
    expect(transaction.rollback).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "El movimiento 1 del snapshot no tiene detalle, valor o forma de pago valida",
    });
  });

  test("responde el cierre sin esperar que termine la conciliacion", async () => {
    let resolverConciliacion;
    const conciliacionPendiente = new Promise((resolve) => {
      resolverConciliacion = resolve;
    });
    conciliarCargasPorFecha.mockReturnValue(conciliacionPendiente);
    CierreCaja.findOne.mockResolvedValue(null);
    CierreCaja.create.mockResolvedValue({ id: 121 });
    MovimientoCaja.bulkCreate.mockResolvedValue([]);
    MovimientoCajaTemp.destroy.mockResolvedValue(0);

    const req = {
      user: { id: 7, usuarioAgenciaId: 11, agenciaId: 3 },
      body: {
        movimientos: [
          {
            responsable: "Ana",
            detalle: "CUOTA",
            valor: 10,
            formaPago: "EFECTIVO",
          },
        ],
      },
    };
    const res = crearRes();

    await cerrarCaja(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        conciliacionEntradas: {
          fecha: expect.any(String),
          cargasProcesadas: 0,
          conciliaciones: [],
          pendiente: true,
          estado: "PENDIENTE",
        },
      }),
    );
    expect(conciliarCargasPorFecha).not.toHaveBeenCalled();

    await esperarTareasEnSegundoPlano();

    expect(conciliarCargasPorFecha).toHaveBeenCalledTimes(1);
    resolverConciliacion({
      fecha: "2026-06-12",
      cargasProcesadas: 0,
      conciliaciones: [],
    });
    await Promise.resolve();
  });

  test("responde un error controlado si no puede iniciar la transaccion", async () => {
    const errorTransaccion = new Error("No hay conexion disponible");
    sequelize.transaction.mockRejectedValueOnce(errorTransaccion);
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    const req = {
      user: { id: 7, usuarioAgenciaId: 11, agenciaId: 3 },
      body: { movimientos: [] },
    };
    const res = crearRes();

    await expect(cerrarCaja(req, res)).resolves.toBe(res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Error al cerrar caja",
      error: "No hay conexion disponible",
    });
    expect(consoleError).toHaveBeenCalledWith(errorTransaccion);
    consoleError.mockRestore();
  });

  test("conserva la respuesta original aunque falle el rollback", async () => {
    const errorRollback = new Error("Conexion perdida durante rollback");
    transaction.rollback.mockRejectedValueOnce(errorRollback);
    UsuarioAgencia.findOne.mockResolvedValue(null);
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    const req = {
      user: { id: 7, usuarioAgenciaId: 11, agenciaId: 3 },
      body: { movimientos: [] },
    };
    const res = crearRes();

    await expect(cerrarCaja(req, res)).resolves.toBe(res);

    expect(transaction.rollback).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledWith(
      "No se pudo revertir la transaccion de cierre de caja:",
      errorRollback,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Usuario sin relacion activa usuario-agencia/agencia para cerrar caja",
    });
    consoleError.mockRestore();
  });

  test("rechaza un segundo cierre activo del mismo usuario en la fecha actual", async () => {
    CierreCaja.findOne.mockResolvedValue(crearCierre({ id: 15 }));

    const req = {
      user: { id: 7, usuarioAgenciaId: 11, agenciaId: 3 },
      body: { denominaciones: [], movimientosPendientes: [] },
    };
    const res = crearRes();

    await cerrarCaja(req, res);

    expect(CierreCaja.create).not.toHaveBeenCalled();
    expect(transaction.rollback).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(409);
  });

  test("permite cerrar caja con movimientos de valor cero", async () => {
    CierreCaja.findOne.mockResolvedValue(null);
    MovimientoCajaTemp.findAll.mockResolvedValue([]);
    CierreCaja.create.mockResolvedValue({ id: 102 });
    MovimientoCaja.bulkCreate.mockResolvedValue([]);
    MovimientoCajaTemp.destroy.mockResolvedValue(0);

    const req = {
      user: { id: 7, usuarioAgenciaId: 11, agenciaId: 3 },
      body: {
        denominaciones: [],
        movimientosPendientes: [
          {
            responsable: "Ana",
            detalle: "CUOTA",
            valor: 0,
            formaPago: "EFECTIVO",
          },
        ],
      },
    };
    const res = crearRes();

    await cerrarCaja(req, res);

    expect(CierreCaja.create).toHaveBeenCalledWith(
      expect.objectContaining({
        totalEfectivo: 0,
        totalSistema: 0,
      }),
      { transaction },
    );
    expect(MovimientoCaja.bulkCreate).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          detalle: "CUOTA",
          valor: 0,
          formaPago: "EFECTIVO",
        }),
      ],
      { transaction },
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("resuelve usuarioAgenciaId desde usuario y agencia si no viene en el token", async () => {
    UsuarioAgencia.findOne.mockResolvedValue({ id: 44, agenciaId: 3 });
    CierreCaja.findOne.mockResolvedValue(null);
    MovimientoCajaTemp.findAll.mockResolvedValue([]);
    CierreCaja.create.mockResolvedValue({ id: 100 });
    MovimientoCaja.bulkCreate.mockResolvedValue([]);
    MovimientoCajaTemp.destroy.mockResolvedValue(0);

    const req = {
      user: { id: 7, agenciaId: 3 },
      body: {
        denominaciones: [{ denominacion: 10, cantidad: 1 }],
        movimientosPendientes: [
          {
            responsable: "Ana",
            detalle: "CUOTA",
            valor: 10,
            formaPago: "EFECTIVO",
          },
        ],
      },
    };
    const res = crearRes();

    await cerrarCaja(req, res);

    expect(UsuarioAgencia.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { usuarioId: 7, agenciaId: 3, activo: true },
        transaction,
      }),
    );
    expect(CierreCaja.create).toHaveBeenCalledWith(
      expect.objectContaining({
        usuarioId: 7,
        usuarioAgenciaId: 44,
        agenciaId: 3,
        usuarioCreacion: "7",
      }),
      { transaction },
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("resuelve agenciaId desde usuarioAgenciaId si el token no lo trae", async () => {
    UsuarioAgencia.findOne.mockResolvedValue({ id: 44, agenciaId: 3 });
    CierreCaja.findOne.mockResolvedValue(null);
    MovimientoCajaTemp.findAll.mockResolvedValue([]);
    CierreCaja.create.mockResolvedValue({ id: 101 });
    MovimientoCaja.bulkCreate.mockResolvedValue([]);
    MovimientoCajaTemp.destroy.mockResolvedValue(0);

    const req = {
      user: { id: 7, usuarioAgenciaId: 44 },
      body: {
        denominaciones: [{ denominacion: 10, cantidad: 1 }],
        movimientosPendientes: [
          {
            responsable: "Ana",
            detalle: "CUOTA",
            valor: 10,
            formaPago: "EFECTIVO",
          },
        ],
      },
    };
    const res = crearRes();

    await cerrarCaja(req, res);

    expect(UsuarioAgencia.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 44, activo: true, usuarioId: 7 },
        attributes: ["id", "agenciaId"],
        transaction,
      }),
    );
    expect(CierreCaja.create).toHaveBeenCalledWith(
      expect.objectContaining({
        usuarioId: 7,
        usuarioAgenciaId: 44,
        agenciaId: 3,
        usuarioCreacion: "7",
      }),
      { transaction },
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("devuelve 400 claro si no puede resolver usuario-agencia/agencia", async () => {
    UsuarioAgencia.findOne.mockResolvedValue(null);

    const req = {
      user: { id: 7, agenciaId: 3 },
      body: {
        denominaciones: [],
        movimientosPendientes: [
          { detalle: "CUOTA", valor: 10, formaPago: "EFECTIVO" },
        ],
      },
    };
    const res = crearRes();

    await cerrarCaja(req, res);

    expect(CierreCaja.create).not.toHaveBeenCalled();
    expect(transaction.rollback).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Usuario sin relacion activa usuario-agencia/agencia para cerrar caja",
    });
  });

  test("filtra cierres por fecha, usuario y estado operativo", async () => {
    CierreCaja.findAll.mockResolvedValue([]);

    const req = {
      query: {
        fechaInicio: "2026-06-01",
        fechaFin: "2026-06-12",
        usuarioId: "7",
        estadoCierre: "REABIERTO",
      },
    };
    const res = crearRes();

    await obtenerTodosLosCierresCaja(req, res);

    expect(CierreCaja.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          fecha: expect.any(Object),
          usuarioId: 7,
          estadoCierre: "REABIERTO",
        }),
      }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("registra auditoria y snapshot al reabrir un cierre cerrado", async () => {
    const cierre = crearCierre();
    CierreCaja.findByPk.mockResolvedValueOnce(cierre).mockResolvedValueOnce(cierre);
    ReaperturaCierreCaja.create.mockResolvedValue({ id: 3 });

    const req = {
      params: { id: "1" },
      user: { id: 99 },
      body: { motivo: "Correccion solicitada" },
    };
    const res = crearRes();

    await reabrirCierreCaja(req, res);

    expect(ReaperturaCierreCaja.create).toHaveBeenCalledWith(
      expect.objectContaining({
        cierreId: 1,
        reabiertoPorUsuarioId: 99,
        motivo: "Correccion solicitada",
        snapshotPrevio: expect.any(Object),
      }),
      { transaction },
    );
    expect(cierre.update).toHaveBeenCalledWith(
      expect.objectContaining({
        estadoCierre: "REABIERTO",
        reabiertoPorUsuarioId: 99,
      }),
      { transaction },
    );
    expect(transaction.commit).toHaveBeenCalled();
    expect(conciliarCargasPorFecha).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("no permite reabrir una caja que ya esta reabierta por otro usuario", async () => {
    const cierre = crearCierre({
      estadoCierre: "REABIERTO",
      reabiertoPorUsuarioId: 77,
    });
    CierreCaja.findByPk.mockResolvedValue(cierre);

    const req = {
      params: { id: "1" },
      user: { id: 99 },
      body: { motivo: "Intento externo" },
    };
    const res = crearRes();

    await reabrirCierreCaja(req, res);

    expect(ReaperturaCierreCaja.create).not.toHaveBeenCalled();
    expect(cierre.update).not.toHaveBeenCalled();
    expect(transaction.rollback).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test("solo permite editar y recerrar un cierre en estado REABIERTO", async () => {
    CierreCaja.findByPk.mockResolvedValue(crearCierre({ estadoCierre: "CERRADO" }));

    const req = {
      params: { id: "1" },
      user: { id: 99 },
      body: {
        movimientos: [{ detalle: "CUOTA", valor: 10, formaPago: "EFECTIVO" }],
      },
    };
    const res = crearRes();

    await actualizarCierreCajaReabierto(req, res);

    expect(MovimientoCaja.destroy).not.toHaveBeenCalled();
    expect(transaction.rollback).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(409);
  });

  test("no permite editar una caja reabierta por otro usuario", async () => {
    const cierre = crearCierre({
      estadoCierre: "REABIERTO",
      reabiertoPorUsuarioId: 77,
    });
    CierreCaja.findByPk.mockResolvedValue(cierre);

    const req = {
      params: { id: "1" },
      user: { id: 99 },
      body: {
        movimientos: [{ detalle: "CUOTA", valor: 10, formaPago: "EFECTIVO" }],
      },
    };
    const res = crearRes();

    await actualizarCierreCajaReabierto(req, res);

    expect(MovimientoCaja.destroy).not.toHaveBeenCalled();
    expect(cierre.update).not.toHaveBeenCalled();
    expect(transaction.rollback).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test("recierra un cierre reabierto y registra quien hizo el recierre", async () => {
    const cierre = crearCierre({
      estadoCierre: "REABIERTO",
      reabiertoPorUsuarioId: 99,
    });
    const reapertura = { update: jest.fn().mockResolvedValue(undefined) };
    CierreCaja.findByPk.mockResolvedValueOnce(cierre).mockResolvedValueOnce(cierre);
    ReaperturaCierreCaja.findOne.mockResolvedValue(reapertura);
    Denominacion.destroy.mockResolvedValue(1);
    RetiroCaja.destroy.mockResolvedValue(1);
    MovimientoCaja.destroy.mockResolvedValue(1);
    MovimientoCaja.bulkCreate.mockResolvedValue([]);

    const req = {
      params: { id: "1" },
      user: { id: 99 },
      body: {
        denominaciones: [{ valor: 10, cantidad: 1 }],
        movimientos: [{ detalle: "CUOTA", valor: 10, formaPago: "EFECTIVO" }],
        retiros: [],
      },
    };
    const res = crearRes();

    await actualizarCierreCajaReabierto(req, res);

    expect(cierre.update).toHaveBeenCalledWith(
      expect.objectContaining({
        estadoCierre: "CERRADO",
        recerradoPorUsuarioId: 99,
        totalFisico: 10,
        totalEfectivo: 10,
      }),
      { transaction },
    );
    expect(reapertura.update).toHaveBeenCalledWith(
      expect.objectContaining({ recerradoPorUsuarioId: 99 }),
      { transaction },
    );
    expect(transaction.commit).toHaveBeenCalled();
    expect(conciliarCargasPorFecha).toHaveBeenCalledWith({
      fecha: "2026-06-12",
      origen: "RECIERRE",
      usuarioId: 99,
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
