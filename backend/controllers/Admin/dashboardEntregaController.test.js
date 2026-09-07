jest.mock("../../models/Entrega", () => ({
  count: jest.fn(),
}));
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
        FechaHoraLlamada: null,
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

  test("todos los indicadores del repartidor omiten entregas inactivas y asignaciones reasignadas", async () => {
    Entrega.count.mockResolvedValue(0);
    const req = { query: { userId: "111", fechaInicio: "2026-08-01", fechaFin: "2026-08-31" } };
    const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
    await getDashboardEntregas(req, res);

    expect(Entrega.count).toHaveBeenCalledTimes(7);
    for (const [options] of Entrega.count.mock.calls) {
      expect(options.where.activo).toBe(true);
      expect(options.where.fecha).toEqual({ [Op.gte]: "2026-08-01", [Op.lte]: "2026-08-31" });
      expect(options.include[0]).toMatchObject({
        as: "repartidores", required: true, where: { id: "111" },
        through: { where: { activo: true } },
      });
      expect(options.distinct).toBe(true);
    }
  });

  test("el total general conserva entregas sin repartidor y evita duplicados", async () => {
    Entrega.count.mockResolvedValue(0);
    const res = { json: jest.fn(), status: jest.fn().mockReturnThis() };
    await getDashboardEntregas({ query: {} }, res);
    for (const [options] of Entrega.count.mock.calls) {
      expect(options.include[0].required).toBe(false);
      expect(options.include[0].where).toBeUndefined();
      expect(options.where.activo).toBe(true);
      expect(options.distinct).toBe(true);
    }
  });
});
