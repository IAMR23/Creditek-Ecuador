const advisorService = require("../../services/ghlAdvisorAvailabilityService");
const distributionService = require("../../services/ghlOpportunityDistributionService");
const controller = require("./repartoOportunidadesController");

const response = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

afterEach(() => jest.restoreAllMocks());

describe("control de disponibilidad GHL", () => {
  test("el asesor solo cambia su propio estado aunque envie otro usuarioId", async () => {
    const schedule = jest.spyOn(distributionService, "scheduleRealtimeQueueReview").mockImplementation(() => {});
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
    expect(schedule).toHaveBeenCalledWith({ trigger: "play" });
  });

  test("el cambio administrativo registra al actor autenticado", async () => {
    const schedule = jest.spyOn(distributionService, "scheduleRealtimeQueueReview").mockImplementation(() => {});
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
    expect(schedule).not.toHaveBeenCalled();
  });

  test("guarda la hora de pausa automatica con el actor autenticado", async () => {
    const save = jest.spyOn(advisorService, "saveAutoPauseConfiguration")
      .mockResolvedValue({ horaPausaAutomatica: "19:30", persistida: true });
    const req = {
      user: { id: 99 },
      body: { horaPausaAutomatica: "19:30" },
    };
    const res = response();

    await controller.saveAdvisorAutoPauseConfiguration(req, res);

    expect(save).toHaveBeenCalledWith({ horaPausaAutomatica: "19:30" }, 99);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      ok: true,
      configuracion: expect.objectContaining({ horaPausaAutomatica: "19:30" }),
    }));
  });

  test("guardar una nueva seleccion solicita una revision segura de la cola", async () => {
    const configuracion = { id: 1, pipelineId: "pipeline-1", stageIds: ["stage-1"], activo: true };
    const save = jest.spyOn(distributionService, "saveRealtimeDistributionConfiguration")
      .mockResolvedValue(configuracion);
    const schedule = jest.spyOn(distributionService, "scheduleRealtimeQueueReview")
      .mockResolvedValue({ code: "REVIEW_PENDING" });
    const req = {
      user: { id: 99 },
      body: { pipelineId: "pipeline-1", stageIds: ["stage-1"], activo: true },
    };
    const res = response();

    await controller.saveRealtimeConfiguration(req, res);

    expect(save).toHaveBeenCalledWith(req.body, 99);
    expect(schedule).toHaveBeenCalledWith({ trigger: "config-update" });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      ok: true,
      configuracion,
      message: expect.stringContaining("guardada"),
    }));
  });
});
