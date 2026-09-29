const service = require("./ghlSmartListService");

const row = (values) => ({
  ...values,
  toJSON() { return { ...values }; },
});

describe("ghlSmartListService", () => {
  test("requiere nombre y al menos un filtro", () => {
    expect(() => service.normalizePayload({ nombre: "Lista", filtros: {} }))
      .toThrow(expect.objectContaining({ code: "GHL_SMART_LIST_FILTER_REQUIRED" }));
    expect(service.normalizePayload({
      nombre: "  Prospectos Facebook  ",
      filtros: { source: "Facebook", tag: "prospecto" },
    })).toEqual({
      nombre: "Prospectos Facebook",
      filtros: {
        logic: "AND",
        rules: [
          { field: "source", operator: "eq", value: "Facebook" },
          { field: "tags", operator: "contains", value: "prospecto" },
        ],
      },
    });
  });

  test("admite reglas combinadas como las listas inteligentes de GHL", () => {
    expect(service.normalizeFilters({
      logic: "AND",
      rules: [
        { field: "tags", operator: "not_eq", value: "regestion" },
        { field: "tags", operator: "eq", value: "bdd uphone" },
        { field: "source", operator: "contains", value: "Meta" },
      ],
    })).toEqual({
      logic: "AND",
      rules: [
        { field: "tags", operator: "not_eq", value: "regestion" },
        { field: "tags", operator: "eq", value: "bdd uphone" },
        { field: "source", operator: "contains", value: "Meta" },
      ],
    });
  });

  test("admite una etapa real asociada a su pipeline", () => {
    expect(service.normalizeFilters({
      rules: [
        {
          field: "pipelineStageId",
          operator: "eq",
          pipelineId: "pipeline-1",
          value: "stage-2",
        },
        { field: "tags", operator: "eq", value: "prospecto" },
      ],
    })).toEqual({
      logic: "AND",
      rules: [
        {
          field: "pipelineStageId",
          operator: "eq",
          pipelineId: "pipeline-1",
          value: "stage-2",
        },
        { field: "tags", operator: "eq", value: "prospecto" },
      ],
    });
  });

  test("exige el pipeline y solo permite una etapa por lista", () => {
    expect(() => service.normalizeRule({
      field: "pipelineStageId",
      operator: "eq",
      value: "stage-2",
    })).toThrow(expect.objectContaining({ code: "GHL_SMART_LIST_PIPELINE_REQUIRED" }));
    expect(() => service.normalizeFilters({
      rules: [
        { field: "pipelineStageId", operator: "eq", pipelineId: "p-1", value: "s-1" },
        { field: "pipelineStageId", operator: "eq", pipelineId: "p-1", value: "s-2" },
      ],
    })).toThrow(expect.objectContaining({ code: "GHL_SMART_LIST_PIPELINE_STAGE_LIMIT" }));
  });

  test("crea una lista compartida con auditoria", async () => {
    const created = row({
      id: 8,
      nombre: "Clientes recientes",
      filtros: {
        logic: "AND",
        rules: [{ field: "query", operator: "contains", value: "Cliente" }],
      },
      creadoPorId: 15,
      actualizadoPorId: 15,
    });
    const model = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(created),
    };

    const result = await service.createSmartList(
      { nombre: "Clientes recientes", filtros: { query: "Cliente" } },
      15,
      { model },
    );

    expect(model.create).toHaveBeenCalledWith(expect.objectContaining({
      creadoPorId: 15,
      actualizadoPorId: 15,
    }));
    expect(result).toMatchObject({ id: 8, nombre: "Clientes recientes" });
  });

  test("aplica los filtros guardados al consultar contactos actuales", async () => {
    const model = {
      findByPk: jest.fn().mockResolvedValue(row({
        id: 3,
        nombre: "Meta interesados",
        filtros: {
          logic: "AND",
          rules: [
            { field: "query", operator: "contains", value: "Ana" },
            { field: "source", operator: "eq", value: "Facebook" },
            { field: "tags", operator: "not_eq", value: "regestion" },
          ],
        },
      })),
    };
    const listContacts = jest.fn().mockResolvedValue({
      contacts: [{ id: "contact-1" }],
      pagination: { page: 2, total: 1 },
    });

    const result = await service.listSmartListContacts(
      3,
      { page: 2, pageSize: 25 },
      { model, listContacts },
    );

    expect(listContacts).toHaveBeenCalledWith({
      query: "Ana",
      page: 2,
      pageSize: 25,
      filters: [
        { field: "source", operator: "eq", value: "Facebook" },
        { field: "tags", operator: "not_eq", value: "regestion" },
      ],
    });
    expect(result.lista).toMatchObject({ id: 3, nombre: "Meta interesados" });
  });
});
