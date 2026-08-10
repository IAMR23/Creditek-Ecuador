jest.mock("../../models/SistemaTarea", () => ({
  findAll: jest.fn(),
  findAndCountAll: jest.fn(),
  count: jest.fn(),
  findByPk: jest.fn(),
}));

jest.mock("../../models/Usuario", () => ({}));

const SistemaTarea = require("../../models/SistemaTarea");
const tareasController = require("./tareasController");

const crearRespuesta = () => {
  const res = {
    status: jest.fn(),
    json: jest.fn(),
  };
  res.status.mockReturnValue(res);
  return res;
};

describe("listarTareasCalendario", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("devuelve las tareas que coinciden con el rango mensual", async () => {
    SistemaTarea.findAll.mockResolvedValue([
      {
        id: 4,
        titulo: "Preparar reporte",
        descripcion: "",
        fechaInicio: "2026-08-10",
        fechaFin: "2026-08-12",
        estado: "en_progreso",
        tiempoAcumuladoSegundos: 120,
      },
    ]);
    const res = crearRespuesta();

    await tareasController.listarTareasCalendario(
      {
        query: {
          fechaInicio: "2026-08-01",
          fechaFin: "2026-08-31",
        },
      },
      res,
    );

    expect(SistemaTarea.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.any(Object),
        order: expect.any(Array),
      }),
    );
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      tareas: [
        expect.objectContaining({
          id: 4,
          titulo: "Preparar reporte",
          fechaInicio: "2026-08-10",
          fechaFin: "2026-08-12",
          status: "en_progreso",
        }),
      ],
    });
  });

  test("rechaza fechas incompletas o invalidas", async () => {
    const res = crearRespuesta();

    await tareasController.listarTareasCalendario(
      {
        query: {
          fechaInicio: "2026-02-30",
          fechaFin: "",
        },
      },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(SistemaTarea.findAll).not.toHaveBeenCalled();
  });

  test("rechaza un rango con la fecha de inicio posterior a la fecha fin", async () => {
    const res = crearRespuesta();

    await tareasController.listarTareasCalendario(
      {
        query: {
          fechaInicio: "2026-09-01",
          fechaFin: "2026-08-31",
        },
      },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(SistemaTarea.findAll).not.toHaveBeenCalled();
  });
});
