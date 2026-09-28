jest.mock("../../services/uphoneSolicitudesService", () => ({
  importarExcel: jest.fn(),
  listar: jest.fn(),
}));

const service = require("../../services/uphoneSolicitudesService");
const controller = require("./uphoneSolicitudesController");

const createResponse = () => {
  const res = {
    status: jest.fn(() => res),
    json: jest.fn(() => res),
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
  });

  test("la importacion por API key no inventa un usuario", async () => {
    const file = { originalname: "uphone.xlsx" };
    const res = createResponse();

    await controller.importarApiKey({ file }, res);

    expect(service.importarExcel).toHaveBeenCalledWith({ file, usuarioId: null });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test("la importacion manual registra al usuario autenticado", async () => {
    const file = { originalname: "uphone.xlsx" };
    const res = createResponse();

    await controller.importarManual({ file, user: { id: 27 } }, res);

    expect(service.importarExcel).toHaveBeenCalledWith({ file, usuarioId: 27 });
    expect(res.status).toHaveBeenCalledWith(201);
  });
});
