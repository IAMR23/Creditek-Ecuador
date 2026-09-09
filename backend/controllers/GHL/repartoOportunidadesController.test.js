const advisorService = require("../../services/ghlAdvisorAvailabilityService");
const controller = require("./repartoOportunidadesController");

const response = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

afterEach(() => jest.restoreAllMocks());

describe("control de disponibilidad GHL", () => {
  test("el asesor solo cambia su propio estado aunque envie otro usuarioId", async () => {
    const change = jest.spyOn(advisorService, "changeAvailability").mockResolvedValue({
      estado: "ACTIVO",
    });
    const req = {
      user: { id: 10 },
      body: { estado: "ACTIVO", usuarioId: 999 },
    };
    const res = response();

    await controller.setMyAvailability(req, res);

    expect(change).toHaveBeenCalledWith({
      usuarioId: 10,
      estado: "ACTIVO",
      actorId: 10,
      motivoCambio: "asesor",
    });
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ ok: true, disponibilidad: { estado: "ACTIVO" } }),
    );
  });

  test("el cambio administrativo registra al actor autenticado", async () => {
    const change = jest.spyOn(advisorService, "changeAvailability").mockResolvedValue({
      estado: "PAUSADO",
    });
    const req = {
      user: { id: 99 },
      params: { usuarioId: "10" },
      body: { estado: "PAUSADO" },
    };
    const res = response();

    await controller.setAdvisorAvailability(req, res);

    expect(change).toHaveBeenCalledWith({
      usuarioId: 10,
      estado: "PAUSADO",
      actorId: 99,
      motivoCambio: "administrador",
    });
  });
});
