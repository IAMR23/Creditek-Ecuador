jest.mock("../../services/uphoneSolicitudesService", () => ({
  eliminarSolicitud: jest.fn(),
  exportarExcel: jest.fn(),
  importarExcel: jest.fn(),
  listar: jest.fn(),
}));
const service = require("../../services/uphoneSolicitudesService");
const controller = require("./uphoneSolicitudesController");

const createResponse = () => {
  const res = {
    status: jest.fn(() => res),
    json: jest.fn(() => res),
    send: jest.fn(() => res),
    setHeader: jest.fn(() => res),
  };
  return res;
};

describe("uphoneSolicitudesController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    service.importarExcel.mockResolvedValue({
      insertadas: 1,
      omitidasDuplicadas: 0,
    });
    service.exportarExcel.mockResolvedValue({
      buffer: Buffer.from("excel"),
      filename: "solicitudes-uphone-2026-09-29.xlsx",
      total: 3,
    });
    service.eliminarSolicitud.mockResolvedValue({
      id: 14,
      numeroSolicitud: "4795152",
      cliente: "CLIENTE PRUEBA",
    });
  });

  test("la importacion por API key no inventa un usuario", async () => {
    const file = { originalname: "uphone.xlsx" };
    const res = createResponse();

    await controller.importarApiKey({ file }, res);

    expect(service.importarExcel).toHaveBeenCalledWith({
      file,
      usuarioId: null,
      requestId: undefined,
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test("la importacion manual registra al usuario autenticado", async () => {
    const file = { originalname: "uphone.xlsx" };
    const res = createResponse();

    await controller.importarManual({ file, user: { id: 27 } }, res);

    expect(service.importarExcel).toHaveBeenCalledWith({
      file,
      usuarioId: 27,
      requestId: undefined,
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test("informa actualizaciones de contrato aunque no haya solicitudes nuevas", async () => {
    service.importarExcel.mockResolvedValue({
      insertadas: 0, actualizadas: 1, omitidasDuplicadas: 0,
    });
    const res = createResponse();
    await controller.importarApiKey({ file: { originalname: "uphone.xlsx" } }, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      message: "0 solicitud(es) nueva(s) y 1 actualizada(s) con contrato aprobado",
      resultado: expect.objectContaining({ actualizadas: 1 }),
    }));
  });

  test("exporta el Excel con los filtros y encabezados de descarga", async () => {
    const res = createResponse();
    const query = { estado: "PENDIENTE", usuarioUphone: "USER2026" };

    await controller.exportar({ query }, res);

    expect(service.exportarExcel).toHaveBeenCalledWith(query);
    expect(res.setHeader).toHaveBeenCalledWith(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(res.setHeader).toHaveBeenCalledWith("X-RVE-Registros", "3");
    expect(res.send).toHaveBeenCalledWith(Buffer.from("excel"));
  });

  test("elimina la solicitud solicitada", async () => {
    const res = createResponse();

    await controller.eliminar({
      params: { id: "14" },
      user: { id: 7 },
    }, res);

    expect(service.eliminarSolicitud).toHaveBeenCalledWith("14");
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      ok: true,
      solicitud: expect.objectContaining({ id: 14 }),
    }));
  });

});
