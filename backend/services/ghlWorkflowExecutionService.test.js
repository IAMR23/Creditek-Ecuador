const ghl = require("./ghlService");
const configurationService = require("./ghlWorkflowConfigurationService");
const service = require("./ghlWorkflowExecutionService");

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
});
