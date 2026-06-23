jest.mock("../../models/CierreCaja/MovimientoCajaTemp", () => ({
  create: jest.fn(),
  destroy: jest.fn(),
  findOne: jest.fn(),
}));

jest.mock("../../models/CierreCaja/CierreCaja", () => ({
  findOne: jest.fn(),
}));

const MovimientoCajaTemp = require("../../models/CierreCaja/MovimientoCajaTemp");
const CierreCaja = require("../../models/CierreCaja/CierreCaja");
const {
  actualizarMovimientoTemp,
  crearMovimientoTemp,
  eliminarMovimientoTemp,
} = require("./MovimientoCajaTemp");

const crearRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

describe("MovimientoCajaTemp controller", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("permite crear movimientos temporales con valor cero", async () => {
    CierreCaja.findOne.mockResolvedValue(null);
    MovimientoCajaTemp.create.mockResolvedValue({ id: 1, valor: 0 });

    const req = {
      user: { id: 7, usuarioAgenciaId: 11 },
      body: {
        responsable: "Ana",
        detalle: "CUOTA",
        valor: "0",
        formaPago: "EFECTIVO",
      },
    };
    const res = crearRes();

    await crearMovimientoTemp(req, res);

    expect(MovimientoCajaTemp.create).toHaveBeenCalledWith(
      expect.objectContaining({
        usuarioAgenciaId: 11,
        detalle: "CUOTA",
        valor: 0,
        formaPago: "EFECTIVO",
      }),
    );
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      data: { id: 1, valor: 0 },
    });
  });

  test("rechaza movimientos temporales con valor negativo", async () => {
    CierreCaja.findOne.mockResolvedValue(null);

    const req = {
      user: { id: 7, usuarioAgenciaId: 11 },
      body: {
        detalle: "CUOTA",
        valor: "-1",
        formaPago: "EFECTIVO",
      },
    };
    const res = crearRes();

    await crearMovimientoTemp(req, res);

    expect(MovimientoCajaTemp.create).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("elimina movimientos temporales solo si pertenecen al usuario-agencia autenticado", async () => {
    MovimientoCajaTemp.destroy.mockResolvedValue(1);

    const req = {
      params: { id: "25" },
      user: { usuarioAgenciaId: 11 },
    };
    const res = crearRes();

    await eliminarMovimientoTemp(req, res);

    expect(MovimientoCajaTemp.destroy).toHaveBeenCalledWith({
      where: { id: "25", usuarioAgenciaId: 11 },
    });
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      message: "Movimiento eliminado",
    });
  });

  test("actualiza movimientos temporales activos del usuario-agencia autenticado", async () => {
    CierreCaja.findOne.mockResolvedValue(null);
    const movimiento = {
      id: 25,
      update: jest.fn().mockResolvedValue(),
    };
    MovimientoCajaTemp.findOne.mockResolvedValue(movimiento);

    const req = {
      params: { id: "25" },
      user: { id: 7, usuarioAgenciaId: 11 },
      body: {
        fecha: "2026-06-23",
        responsable: "Raul",
        detalle: "CUOTA",
        valor: "18.30",
        formaPago: "EFECTIVO",
        recibo: 555,
        entidad: "Cliente",
        observacion: "Editado",
      },
    };
    const res = crearRes();

    await actualizarMovimientoTemp(req, res);

    expect(MovimientoCajaTemp.findOne).toHaveBeenCalledWith({
      where: {
        id: "25",
        usuarioAgenciaId: 11,
        estado: "ACTIVO",
      },
    });
    expect(movimiento.update).toHaveBeenCalledWith(
      expect.objectContaining({
        responsable: "Raul",
        detalle: "CUOTA",
        valor: 18.3,
        formaPago: "EFECTIVO",
        recibo: 555,
        entidad: "Cliente",
        observacion: "Editado",
        estado: "ACTIVO",
      }),
    );
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      data: movimiento,
      message: "Movimiento actualizado",
    });
  });
});
