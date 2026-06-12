jest.mock("../../models/CierreCaja/MovimientoCajaTemp", () => ({
  destroy: jest.fn(),
}));

jest.mock("../../models/CierreCaja/CierreCaja", () => ({
  findOne: jest.fn(),
}));

const MovimientoCajaTemp = require("../../models/CierreCaja/MovimientoCajaTemp");
const { eliminarMovimientoTemp } = require("./MovimientoCajaTemp");

const crearRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

describe("MovimientoCajaTemp controller", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
});
