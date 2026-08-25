jest.mock("../../models/Entrega", () => ({
  count: jest.fn(),
}));
jest.mock("../../models/UsuarioAgenciaEntrega", () => ({}));
jest.mock("../../models/UsuarioAgencia", () => ({}));

const { Op } = require("sequelize");
const Entrega = require("../../models/Entrega");
const { getDashboardEntregas } = require("./dashboardEntregaController");

describe("getDashboardEntregas", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("incluye la cantidad de procesos completos en el resumen", async () => {
    Entrega.count
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(11)
      .mockResolvedValueOnce(5);

    const req = {
      query: {
        fechaInicio: "2026-08-01",
        fechaFin: "2026-08-25",
      },
    };
    const res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };

    await getDashboardEntregas(req, res);

    expect(Entrega.count).toHaveBeenCalledTimes(7);
    const opcionesProcesosCompletos = Entrega.count.mock.calls.at(-1)[0];
    expect(opcionesProcesosCompletos.where.procesoCompleto).toBeUndefined();
    expect(opcionesProcesosCompletos.where[Op.and]).toEqual([
      {
        [Op.or]: [{ FechaHoraLlamada: null }, { FechaHoraLlamada: "" }],
      },
      {
        [Op.or]: [{ fotoFechaLlamada: null }, { fotoFechaLlamada: "" }],
      },
    ]);
    expect(opcionesProcesosCompletos.distinct).toBe(true);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        total: 11,
        procesosCompletos: 5,
        porEstado: {
          pendiente: 3,
          transito: 2,
          revisar: 1,
          entregado: 4,
          noEntregado: 1,
        },
      }),
    );
  });
});
