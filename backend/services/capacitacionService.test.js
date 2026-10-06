jest.mock("../models/SistemaCapacitacionVideo", () => ({
  findAll: jest.fn(),
  findByPk: jest.fn(),
  create: jest.fn(),
}));

const SistemaCapacitacionVideo = require("../models/SistemaCapacitacionVideo");
const capacitacionService = require("./capacitacionService");

describe("servicio de capacitación", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("los vendedores reciben únicamente videos activos", async () => {
    SistemaCapacitacionVideo.findAll.mockResolvedValue([]);

    await capacitacionService.listar({
      user: { id: 4, permisos: ["Ventas"] },
      incluirInactivos: true,
    });

    expect(SistemaCapacitacionVideo.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ where: { activo: true } }),
    );
  });

  test("Sistemas puede consultar videos activos e inactivos", async () => {
    SistemaCapacitacionVideo.findAll.mockResolvedValue([]);

    await capacitacionService.listar({
      user: { id: 8, permisos: ["Sistemas"] },
      incluirInactivos: true,
    });

    expect(SistemaCapacitacionVideo.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
  });

  test("registra un enlace de Google Drive con los usuarios de auditoría", async () => {
    SistemaCapacitacionVideo.create.mockResolvedValue({ id: 1 });

    await capacitacionService.crear({
      user: { id: 12, permisos: ["Sistemas"] },
      data: {
        titulo: "Proceso comercial",
        enlace: "https://drive.google.com/file/d/1AbC_def-123/view?usp=sharing",
        descripcion: "Descripción del proceso",
      },
    });

    expect(SistemaCapacitacionVideo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        creadoPorId: 12,
        actualizadoPorId: 12,
        activo: true,
        enlace: "https://drive.google.com/file/d/1AbC_def-123/view?usp=sharing",
      }),
    );
  });

  test("actualiza sin borrar el registro", async () => {
    const video = { update: jest.fn().mockResolvedValue(undefined) };
    SistemaCapacitacionVideo.findByPk.mockResolvedValue(video);

    const resultado = await capacitacionService.actualizar({
      videoId: 3,
      user: { id: 14, permisos: ["Administracion"] },
      data: { activo: false },
    });

    expect(video.update).toHaveBeenCalledWith({
      activo: false,
      actualizadoPorId: 14,
    });
    expect(resultado).toBe(video);
  });
});
