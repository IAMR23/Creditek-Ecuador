jest.mock("../../models/Agencia", () => ({
  findAll: jest.fn(),
  findOne: jest.fn(),
}));

jest.mock("../../models/ReporteCajaUsuarioAgencia", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
  findOne: jest.fn(),
}));

const Agencia = require("../../models/Agencia");
const ReporteCajaUsuarioAgencia = require("../../models/ReporteCajaUsuarioAgencia");
const controller = require("./reporteCajaAgenciasController");

const crearRes = () => {
  const res = {
    json: jest.fn(),
    status: jest.fn(),
  };
  res.status.mockReturnValue(res);
  return res;
};

describe("reporteCajaAgenciasController", () => {
  beforeEach(() => jest.clearAllMocks());

  test("lista configuraciones y agencias activas", async () => {
    ReporteCajaUsuarioAgencia.findAll.mockResolvedValue([
      {
        id: 1,
        codigoUsuario: "ALEXFER",
        agenciaId: 2,
        agencia: { id: 2, nombre: "NUEVA AURORA" },
        fechaDesde: "2000-01-01",
        fechaHasta: null,
        activo: true,
      },
    ]);
    Agencia.findAll.mockResolvedValue([{ id: 2, nombre: "NUEVA AURORA" }]);
    const res = crearRes();

    await controller.listar({}, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        configuraciones: [
          expect.objectContaining({
            codigoUsuario: "ALEXFER",
            agenciaId: 2,
          }),
        ],
      }),
    );
  });

  test("crea una asignacion normalizando el codigo a mayusculas", async () => {
    Agencia.findOne.mockResolvedValue({ id: 3 });
    ReporteCajaUsuarioAgencia.findOne.mockResolvedValue(null);
    ReporteCajaUsuarioAgencia.create.mockResolvedValue({ id: 9 });
    ReporteCajaUsuarioAgencia.findByPk.mockResolvedValue({
      id: 9,
      codigoUsuario: "NUEVOUSR",
      agenciaId: 3,
      agencia: { id: 3, nombre: "CAUPICHO" },
      activo: true,
    });
    const res = crearRes();

    await controller.crear(
      {
        body: {
          codigoUsuario: "  nuevousr ",
          agenciaId: "3",
          fechaDesde: "2026-09-01",
          fechaHasta: "2026-09-30",
        },
      },
      res,
    );

    expect(ReporteCajaUsuarioAgencia.create).toHaveBeenCalledWith({
      codigoUsuario: "NUEVOUSR",
      agenciaId: 3,
      fechaDesde: "2026-09-01",
      fechaHasta: "2026-09-30",
      activo: true,
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test("rechaza periodos superpuestos para el mismo codigo", async () => {
    Agencia.findOne.mockResolvedValue({ id: 3 });
    ReporteCajaUsuarioAgencia.findOne.mockResolvedValue({
      id: 2,
      fechaDesde: "2026-09-01",
      fechaHasta: null,
    });
    const res = crearRes();

    await controller.crear(
      {
        body: {
          codigoUsuario: "NUEVOUSR",
          agenciaId: 3,
          fechaDesde: "2026-09-15",
          fechaHasta: null,
        },
      },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(409);
    expect(ReporteCajaUsuarioAgencia.create).not.toHaveBeenCalled();
  });

  test("desactiva sin borrar fisicamente la configuracion", async () => {
    const update = jest.fn().mockResolvedValue(undefined);
    ReporteCajaUsuarioAgencia.findOne.mockResolvedValue({ id: 4, update });
    const res = crearRes();

    await controller.eliminar({ params: { id: "4" } }, res);

    expect(update).toHaveBeenCalledWith({ activo: false });
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ ok: true }),
    );
  });
});
