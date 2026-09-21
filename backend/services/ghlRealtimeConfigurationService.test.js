const service = require("./ghlOpportunityDistributionService");
const ghl = require("./ghlService");

const pipelines = [
  {
    id: "pipeline-1",
    name: "Ventas",
    stages: [
      { id: "stage-1", name: "Entrada" },
      { id: "stage-2", name: "Contacto" },
    ],
  },
  {
    id: "pipeline-2",
    name: "Postventa",
    stages: [{ id: "stage-3", name: "Seguimiento" }],
  },
];

describe("configuracion del reparto GHL en tiempo real", () => {
  beforeEach(() => {
    jest.spyOn(ghl, "getGhlConfig").mockReturnValue({ locationId: "location-1" });
    jest.spyOn(ghl, "createGhlClient").mockReturnValue({ request: jest.fn() });
    jest.spyOn(ghl, "fetchPipelines").mockResolvedValue(pipelines);
  });

  afterEach(() => jest.restoreAllMocks());

  test("acepta varias etapas y deriva sus nombres desde GHL", async () => {
    await expect(service.validateRealtimeConfigurationInput({
      pipelineId: "pipeline-1",
      stageIds: ["stage-1", "stage-2"],
      maxPendientesPorAsesor: 2,
      activo: true,
    })).resolves.toEqual(expect.objectContaining({
      pipelineId: "pipeline-1",
      pipelineNombre: "Ventas",
      stageIds: ["stage-1", "stage-2"],
      stageNombres: ["Entrada", "Contacto"],
    }));
  });

  test("rechaza una etapa que pertenece a otro pipeline", async () => {
    await expect(service.validateRealtimeConfigurationInput({
      pipelineId: "pipeline-1",
      stageIds: ["stage-3"],
      maxPendientesPorAsesor: 2,
      activo: true,
    })).rejects.toMatchObject({ code: "REALTIME_STAGE_PIPELINE_MISMATCH", statusCode: 400 });
  });

  test("rechaza IDs de etapa duplicados", async () => {
    await expect(service.validateRealtimeConfigurationInput({
      pipelineId: "pipeline-1",
      stageIds: ["stage-1", "stage-1"],
      maxPendientesPorAsesor: 2,
      activo: true,
    })).rejects.toMatchObject({ code: "DUPLICATE_REALTIME_STAGE_IDS", statusCode: 400 });
    expect(ghl.fetchPipelines).not.toHaveBeenCalled();
  });

  test("no permite activar sin etapas", async () => {
    await expect(service.validateRealtimeConfigurationInput({
      pipelineId: "pipeline-1",
      stageIds: [],
      maxPendientesPorAsesor: 2,
      activo: true,
    })).rejects.toMatchObject({ code: "REALTIME_STAGES_REQUIRED", statusCode: 400 });
  });
});
