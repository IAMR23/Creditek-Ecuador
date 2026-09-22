const ghl = require("./ghlService");
const configurationService = require("./ghlWorkflowConfigurationService");
const service = require("./ghlWorkflowExecutionService");
const executionLock = require("./ghlWorkflowExecutionLock");
const Programacion = require("../models/GhlWorkflowProgramacion");
const Ejecucion = require("../models/GhlWorkflowEjecucion");
const Detalle = require("../models/GhlWorkflowEjecucionDetalle");

afterEach(() => jest.restoreAllMocks());

const programacion = {
  id: 7,
  nombre: "Seguimiento",
  pipelineId: "pipeline-1",
  pipelineNombre: "Ventas",
  stageIds: ["stage-1", "stage-2"],
  stageNombres: [{ id: "stage-1", nombre: "WhatsApp" }, { id: "stage-2", nombre: "Facebook" }],
  workflowId: "workflow-1",
  workflowNombre: "Seguimiento automatico",
  hora: "10:00",
  diasSemana: [1, 2, 3, 4, 5, 6],
  zonaHoraria: "America/Guayaquil",
  permitirReingreso: false,
  activo: true,
};

describe("ejecucion de workflows programados", () => {
  test("solo genera ventana en dias seleccionados y despues de la hora local", () => {
    expect(service.scheduledWindow(programacion, new Date("2026-09-21T14:59:00.000Z"))).toBeNull();
    expect(service.scheduledWindow(programacion, new Date("2026-09-21T15:00:00.000Z"))).toMatchObject({
      id: "7:2026-09-21:10:00",
      date: "2026-09-21",
    });
    expect(service.scheduledWindow(programacion, new Date("2026-09-20T16:00:00.000Z"))).toBeNull();
    expect(service.scheduledWindow({ ...programacion, activo: false }, new Date("2026-09-21T15:00:00.000Z"))).toBeNull();
  });

  test("rechaza oportunidades cerradas, cambiadas de etapa, pipeline o sin contactId", () => {
    expect(service.isEligibleOpportunity({ status: "open", pipelineId: "pipeline-1", pipelineStageId: "stage-1", contactId: "c1" }, programacion)).toBe(true);
    expect(service.isEligibleOpportunity({ status: "won", pipelineId: "pipeline-1", pipelineStageId: "stage-1", contactId: "c1" }, programacion)).toBe(false);
    expect(service.isEligibleOpportunity({ status: "open", pipelineId: "pipeline-2", pipelineStageId: "stage-1", contactId: "c1" }, programacion)).toBe(false);
    expect(service.isEligibleOpportunity({ status: "open", pipelineId: "pipeline-1", pipelineStageId: "stage-9", contactId: "c1" }, programacion)).toBe(false);
    expect(service.isEligibleOpportunity({ status: "open", pipelineId: "pipeline-1", pipelineStageId: "stage-1" }, programacion)).toBe(false);
  });

  test("consulta todas las etapas y deduplica oportunidades y contactos", async () => {
    jest.spyOn(ghl, "getGhlConfig").mockReturnValue({ locationId: "loc", apiVersion: "v3" });
    jest.spyOn(ghl, "createGhlClient").mockReturnValue({});
    const fetch = jest.spyOn(ghl, "fetchOpportunitiesByStatus")
      .mockImplementationOnce(async (...args) => {
        args[4].onPage({ page: 1 }); args[4].onPage({ page: 2 });
        return [
          { id: "o1", status: "open", pipelineId: "pipeline-1", pipelineStageId: "stage-1", contactId: "c1" },
          { id: "o2", status: "open", pipelineId: "pipeline-1", pipelineStageId: "stage-1", contactId: "c1" },
        ];
      })
      .mockImplementationOnce(async (...args) => {
        args[4].onPage({ page: 1 });
        return [
          { id: "o2", status: "open", pipelineId: "pipeline-1", pipelineStageId: "stage-2", contactId: "c1" },
          { id: "o3", status: "open", pipelineId: "pipeline-1", pipelineStageId: "stage-2", contactId: "c2" },
        ];
      });
    const result = await service.collectEligible(programacion);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls.map((call) => call[1].pipelineStageId)).toEqual(["stage-1", "stage-2"]);
    expect(result.valid.map((row) => row.id)).toEqual(["o1", "o2", "o3"]);
    expect([...result.byContact.keys()]).toEqual(["c1", "c2"]);
    expect(result.pages).toBe(3);
  });

  test("la vista previa nunca inscribe contactos", async () => {
    jest.spyOn(configurationService, "validateInput").mockResolvedValue(programacion);
    jest.spyOn(ghl, "getGhlConfig").mockReturnValue({ locationId: "loc", apiVersion: "v3" });
    jest.spyOn(ghl, "createGhlClient").mockReturnValue({});
    jest.spyOn(ghl, "fetchOpportunitiesByStatus").mockResolvedValue([]);
    const enroll = jest.spyOn(ghl, "enrollContactInWorkflow");
    const result = await service.preview(programacion);
    expect(result.inscripcionesRealizadas).toBe(0);
    expect(enroll).not.toHaveBeenCalled();
  });

  test("revalida por ID solamente las oportunidades capturadas al inicio", async () => {
    const changed = { id: "o1", status: "won", pipelineId: "pipeline-1", pipelineStageId: "stage-1", contactId: "c1" };
    const eligible = { id: "o2", status: "open", pipelineId: "pipeline-1", pipelineStageId: "stage-2", contactId: "c1" };
    const fetch = jest.spyOn(ghl, "fetchOpportunityById")
      .mockResolvedValueOnce(changed)
      .mockResolvedValueOnce(eligible);
    await expect(service.revalidateContact({}, programacion, [{ id: "o1" }, { id: "o2" }]))
      .resolves.toEqual(eligible);
    expect(fetch.mock.calls.map((call) => call[1])).toEqual(["o1", "o2"]);
  });

  test("antes del POST revalida ejecucion, configuracion, oportunidad y workflow", async () => {
    const detail = {
      id: 31,
      estado: "pending",
      contactId: "c1",
      workflowId: "workflow-1",
      intentos: 0,
      update: jest.fn(async function update(values) { Object.assign(this, values); return this; }),
    };
    const execution = { id: 11, configuracionId: 7, fechaLocal: "2026-09-21", update: jest.fn() };
    const opportunity = { id: "o1", status: "open", pipelineId: "pipeline-1", pipelineStageId: "stage-1", contactId: "c1" };
    jest.spyOn(Programacion, "findByPk").mockResolvedValue(programacion);
    jest.spyOn(Ejecucion, "findByPk").mockResolvedValue({ estado: "running" });
    jest.spyOn(Detalle, "findByPk").mockResolvedValue(detail);
    jest.spyOn(Detalle, "findOne").mockResolvedValue(null);
    jest.spyOn(executionLock, "acquire").mockResolvedValue({ connection: {} });
    jest.spyOn(executionLock, "release").mockResolvedValue();
    jest.spyOn(ghl, "fetchOpportunityById").mockResolvedValue(opportunity);
    const validate = jest.spyOn(ghl, "validateWorkflow").mockResolvedValue({ id: "workflow-1", status: "published" });
    const enroll = jest.spyOn(ghl, "enrollContactInWorkflow").mockResolvedValue({ succeeded: true });

    await service.processDetail(detail, execution, {
      client: {}, config: { locationId: "loc" }, byContact: new Map([["c1", [opportunity]]]),
    });

    expect(validate).toHaveBeenCalledTimes(1);
    expect(enroll).toHaveBeenCalledTimes(1);
    expect(detail.update.mock.calls[0][0]).toMatchObject({ estado: "processing", intentos: 1, opportunityId: "o1" });
    expect(detail.estado).toBe("success");
  });

  test("omite el contacto si la ejecucion dejo de estar activa", async () => {
    const detail = {
      id: 32, estado: "pending", contactId: "c1", workflowId: "workflow-1", intentos: 0,
      update: jest.fn(async function update(values) { Object.assign(this, values); return this; }),
    };
    jest.spyOn(Programacion, "findByPk").mockResolvedValue(programacion);
    jest.spyOn(Ejecucion, "findByPk").mockResolvedValue({ estado: "interrupted" });
    jest.spyOn(Detalle, "findByPk").mockResolvedValue(detail);
    jest.spyOn(executionLock, "acquire").mockResolvedValue({ connection: {} });
    jest.spyOn(executionLock, "release").mockResolvedValue();
    const enroll = jest.spyOn(ghl, "enrollContactInWorkflow");

    await service.processDetail(detail, { id: 12, configuracionId: 7, fechaLocal: "2026-09-21" }, {
      client: {}, config: {}, byContact: new Map(),
    });

    expect(detail).toMatchObject({ estado: "skipped", errorCode: "EXECUTION_NOT_ACTIVE" });
    expect(enroll).not.toHaveBeenCalled();
  });

  test("omite el contacto si la oportunidad cambio antes de inscribir", async () => {
    const detail = {
      id: 33, estado: "pending", contactId: "c1", workflowId: "workflow-1", intentos: 0,
      update: jest.fn(async function update(values) { Object.assign(this, values); return this; }),
    };
    const changed = { id: "o1", status: "lost", pipelineId: "pipeline-1", pipelineStageId: "stage-1", contactId: "c1" };
    jest.spyOn(Programacion, "findByPk").mockResolvedValue(programacion);
    jest.spyOn(Ejecucion, "findByPk").mockResolvedValue({ estado: "running" });
    jest.spyOn(Detalle, "findByPk").mockResolvedValue(detail);
    jest.spyOn(Detalle, "findOne").mockResolvedValue(null);
    jest.spyOn(executionLock, "acquire").mockResolvedValue({ connection: {} });
    jest.spyOn(executionLock, "release").mockResolvedValue();
    jest.spyOn(ghl, "fetchOpportunityById").mockResolvedValue(changed);
    const enroll = jest.spyOn(ghl, "enrollContactInWorkflow");

    await service.processDetail(detail, { id: 13, configuracionId: 7, fechaLocal: "2026-09-21" }, {
      client: {}, config: {}, byContact: new Map([["c1", [changed]]]),
    });

    expect(detail).toMatchObject({ estado: "skipped", errorCode: "OPPORTUNITY_NO_LONGER_ELIGIBLE" });
    expect(enroll).not.toHaveBeenCalled();
  });

  test("reingreso desactivado consulta exitos previos de la misma configuracion", async () => {
    const findOne = jest.spyOn(Detalle, "findOne").mockResolvedValue(null);
    await service.hasPriorSuccess(programacion, { id: 9, contactId: "c1", workflowId: "workflow-1" }, { fechaLocal: "2026-09-21" });
    expect(findOne.mock.calls[0][0].where).toMatchObject({ configuracionId: 7, contactId: "c1", workflowId: "workflow-1", estado: "success" });
  });

  test("reingreso activado limita por contacto, workflow y dia local", async () => {
    const findOne = jest.spyOn(Detalle, "findOne").mockResolvedValue(null);
    await service.hasPriorSuccess({ ...programacion, permitirReingreso: true }, { id: 9, contactId: "c1", workflowId: "workflow-1" }, { fechaLocal: "2026-09-21" });
    expect(findOne.mock.calls[0][0].where).toMatchObject({ contactId: "c1", workflowId: "workflow-1", fechaLocal: "2026-09-21", estado: "success" });
    expect(findOne.mock.calls[0][0].where).not.toHaveProperty("configuracionId");
  });

  test("recuperacion convierte inscripciones ambiguas en fallos definitivos", async () => {
    jest.spyOn(Ejecucion, "findAll").mockResolvedValue([{ id: 90, configuracionId: 7 }]);
    const detailUpdate = jest.spyOn(Detalle, "update").mockResolvedValue([1]);
    jest.spyOn(Ejecucion, "update").mockResolvedValue([1]);
    jest.spyOn(executionLock, "acquire").mockResolvedValue({ connection: {} });
    jest.spyOn(executionLock, "release").mockResolvedValue();
    await expect(service.recoverStaleRuns(new Date("2026-09-21T15:10:00.000Z"))).resolves.toBe(1);
    expect(detailUpdate.mock.calls[0][0]).toMatchObject({ estado: "failed_final", errorCode: "AMBIGUOUS_ENROLLMENT_RESULT" });
    expect(detailUpdate.mock.calls[0][1].where.estado).toBe("processing");
  });

  test("no interrumpe una ejecucion cuyo advisory lock sigue ocupado", async () => {
    jest.spyOn(Ejecucion, "findAll").mockResolvedValue([{ id: 91, configuracionId: 7 }]);
    jest.spyOn(executionLock, "acquire").mockResolvedValue(null);
    const updateExecution = jest.spyOn(Ejecucion, "update");
    const updateDetail = jest.spyOn(Detalle, "update");
    await expect(service.recoverStaleRuns(new Date("2026-09-21T15:10:00.000Z"))).resolves.toBe(0);
    expect(updateExecution).not.toHaveBeenCalled();
    expect(updateDetail).not.toHaveBeenCalled();
  });
});
