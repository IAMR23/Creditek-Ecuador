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

const { sequelize } = require("../../config/db");
const CierreCaja = require("../../models/CierreCaja/CierreCaja");
const MovimientoCaja = require("../../models/CierreCaja/MovimientoCaja");
const MovimientoCajaTemp = require("../../models/CierreCaja/MovimientoCajaTemp");
const Denominacion = require("../../models/CierreCaja/Denominacion");
const RetiroCaja = require("../../models/CierreCaja/RetiroCaja");
const ReaperturaCierreCaja = require("../../models/CierreCaja/ReaperturaCierreCaja");
const UsuarioAgencia = require("../../models/UsuarioAgencia");
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
    expect(res.status).toHaveBeenCalledWith(200);
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
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
