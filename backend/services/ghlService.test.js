const axios = require("axios");
const {
  buildOpportunitiesMatrix,
  errorHasAnyMessage,
  extractCompanyIdFromLocation,
  filterOpportunitiesByDateRange,
  isOpportunityWithinDateRange,
  isOpportunityUpdatedWithinDateRange,
  getNextPaginationCursor,
  getNextStartAfterId,
  resolveDateFilters,
  shouldStopDatePagination,
  normalizeGhlError,
  fetchAllAssignableUsers,
  fetchOpportunitiesByStatus,
  fetchOpportunitiesByUpdatedDate,
  enviarAGHL,
  obtenerMatrizOportunidadesDashboard,
} = require("./ghlService");

describe("ghlService matrix builder", () => {
  test("rechaza identificadores LID antes de intentar el upsert del contacto", async () => {
    await expect(enviarAGHL({
      phone: "+593137009859449042",
      message: "Hola",
      isFromMe: false,
    })).rejects.toMatchObject({
      code: "INVALID_CONTACT_PHONE",
      statusCode: 400,
    });
  });

  test("consulta el dashboard con el unico pipeline sin exigir GHL_PIPELINE_ID", async () => {
    const previousEnvironment = {
      token: process.env.GHL_TOKEN,
      locationId: process.env.GHL_LOCATION_ID,
      pipelineId: process.env.GHL_PIPELINE_ID,
    };
    process.env.GHL_TOKEN = "token-test";
    process.env.GHL_LOCATION_ID = "location-1";
    delete process.env.GHL_PIPELINE_ID;

    const client = {
      request: jest.fn(({ url }) => {
        if (url === "/opportunities/pipelines") {
          return Promise.resolve({
            data: {
              pipelines: [
                {
                  id: "pipeline-1",
                  name: "Ventas",
                  stages: [{ id: "stage-1", name: "Nuevo" }],
                },
              ],
            },
          });
        }
        if (url === "/opportunities/search") {
          return Promise.resolve({ data: { opportunities: [] } });
        }
        if (url === "/locations/location-1") {
          return Promise.resolve({ data: { location: { companyId: "company-1" } } });
        }
        if (url === "/users/search") {
          return Promise.resolve({ data: { users: [] } });
        }
        return Promise.reject(new Error(`Solicitud inesperada: ${url}`));
      }),
    };
    const createClientSpy = jest.spyOn(axios, "create").mockReturnValue(client);

    try {
      const matrix = await obtenerMatrizOportunidadesDashboard();
      const opportunityRequest = client.request.mock.calls
        .map(([request]) => request)
        .find((request) => request.url === "/opportunities/search");

      expect(opportunityRequest.params.pipelineId).toBe("pipeline-1");
      expect(opportunityRequest.params.order).toBe("added_desc");
      expect(matrix.meta.pipelineId).toBe("pipeline-1");
    } finally {
      createClientSpy.mockRestore();
      if (previousEnvironment.token === undefined) delete process.env.GHL_TOKEN;
      else process.env.GHL_TOKEN = previousEnvironment.token;
      if (previousEnvironment.locationId === undefined) {
        delete process.env.GHL_LOCATION_ID;
      } else {
        process.env.GHL_LOCATION_ID = previousEnvironment.locationId;
      }
      if (previousEnvironment.pipelineId === undefined) {
        delete process.env.GHL_PIPELINE_ID;
      } else {
        process.env.GHL_PIPELINE_ID = previousEnvironment.pipelineId;
      }
    }
  });

  test("agrupa oportunidades abiertas por propietario y etapa", () => {
    const matrix = buildOpportunitiesMatrix({
      pipelineId: "pipeline-1",
      pipelines: [
        {
          id: "pipeline-1",
          name: "Ventas",
          stages: [
            { id: "facebook", name: "Facebook" },
            { id: "whatsapp", name: "WhatsApp" },
            { id: "aplica", name: "Aplica" },
          ],
        },
      ],
      users: [
        { id: "user-1", name: "Ashley" },
        { id: "user-2", firstName: "Pepe" },
      ],
      opportunities: [
        { id: "opp-1", pipelineId: "pipeline-1", pipelineStageId: "facebook", assignedTo: "user-1" },
        { id: "opp-2", pipelineId: "pipeline-1", pipelineStageId: "facebook", assignedTo: "user-1" },
        { id: "opp-3", pipelineId: "pipeline-1", pipelineStageId: "whatsapp", assignedTo: "user-1" },
        { id: "opp-4", pipelineId: "pipeline-1", pipelineStageId: "aplica", assignedTo: "user-2" },
        { id: "opp-5", pipelineId: "pipeline-2", pipelineStageId: "aplica", assignedTo: "user-2" },
      ],
    });

    expect(matrix.columns.map((column) => column.name)).toEqual([
      "Facebook",
      "WhatsApp",
      "Aplica",
    ]);
    expect(matrix.rows).toHaveLength(2);
    expect(matrix.rows[0]).toMatchObject({
      ownerName: "Ashley",
      total: 3,
      values: {
        facebook: 2,
        whatsapp: 1,
        aplica: 0,
      },
    });
    expect(matrix.rows[1]).toMatchObject({
      ownerName: "Pepe",
      total: 1,
      values: {
        facebook: 0,
        whatsapp: 0,
        aplica: 1,
      },
    });
    expect(matrix.totals).toMatchObject({
      total: 4,
      values: {
        facebook: 2,
        whatsapp: 1,
        aplica: 1,
      },
    });
  });

  test("maneja datos nulos y etapas no encontradas", () => {
    const matrix = buildOpportunitiesMatrix({
      pipelineId: "pipeline-1",
      pipelines: [{ id: "pipeline-1", name: "Ventas", stages: [] }],
      users: [],
      opportunities: [
        { id: "opp-1", pipelineId: "pipeline-1", pipelineStageId: null, assignedTo: null },
        { id: "opp-2", pipelineId: "pipeline-1", pipelineStageId: "stage-x", assignedTo: "user-x" },
      ],
    });

    expect(matrix.columns.map((column) => column.name)).toEqual([
      "Sin etapa",
      "Etapa no encontrada",
    ]);
    expect(matrix.rows.map((row) => row.ownerName)).toEqual([
      "Propietario no encontrado",
      "Sin propietario",
    ]);
    expect(matrix.totals.total).toBe(2);
  });

  test("extrae cursor de paginacion desde nextPageUrl o ultimo registro", () => {
    expect(
      getNextStartAfterId(
        {
          meta: {
            nextPageUrl:
              "https://services.leadconnectorhq.com/opportunities/search?startAfterId=abc123",
          },
        },
        [],
        100,
      ),
    ).toBe("abc123");

    expect(getNextStartAfterId({}, [{ id: "last-id" }], 1)).toBe("last-id");
  });

  test("extrae cursor completo de paginacion de HighLevel", () => {
    expect(
      getNextPaginationCursor(
        {
          meta: {
            nextPageUrl:
              "https://services.leadconnectorhq.com/opportunities/search?startAfter=1782231635086&startAfterId=abc123",
          },
        },
        [],
        100,
      ),
    ).toEqual({
      startAfterId: "abc123",
      startAfter: "1782231635086",
    });
  });

  test("detecta errores de validacion de parametros de HighLevel", () => {
    const error = new Error("Bad request");
    error.message = [
      "property locationId should not exist",
      "location_id must be a string",
    ];

    expect(
      errorHasAnyMessage(error, [
        "property locationId should not exist",
        "location_id must be a string",
      ]),
    ).toBe(true);
  });

  test("extrae companyId desde el payload de location", () => {
    expect(
      extractCompanyIdFromLocation({
        location: {
          id: "location-1",
          companyId: "company-1",
        },
      }),
    ).toBe("company-1");
  });

  test("filtra oportunidades por fecha de creacion o actualizacion", () => {
    const filtered = filterOpportunitiesByDateRange(
      [
        { id: "opp-1", createdAt: "2026-06-01T12:00:00.000Z" },
        { id: "opp-2", dateAdded: "2026-06-15T18:00:00.000Z" },
        { id: "opp-3", created_at: "2026-07-01T12:00:00.000Z" },
        { id: "opp-4", createdAt: null },
        {
          id: "opp-5",
          createdAt: "2025-01-01T12:00:00.000Z",
          updatedAt: "2026-06-20T12:00:00.000Z",
        },
      ],
      {
        fechaInicio: "2026-06-01",
        fechaFin: "2026-06-30",
      },
    );

    expect(filtered.map((opportunity) => opportunity.id)).toEqual(["opp-1", "opp-2", "opp-5"]);
  });

  test("acepta una oportunidad si cualquiera de sus fechas esta en el rango", () => {
    const range = { fechaInicio: "2026-09-19", fechaFin: "2026-09-21" };

    expect(isOpportunityWithinDateRange({
      createdAt: "2025-01-01T12:00:00.000Z",
      updatedAt: "2026-09-20T12:00:00.000Z",
    }, range)).toBe(true);
    expect(isOpportunityWithinDateRange({
      createdAt: "2026-09-19T05:00:00.000Z",
      updatedAt: "2026-09-22T05:00:00.000Z",
    }, range)).toBe(true);
    expect(isOpportunityWithinDateRange({
      createdAt: "2026-09-18T12:00:00.000Z",
      updatedAt: "2026-09-18T13:00:00.000Z",
    }, range)).toBe(false);
  });

  test("el reparto puede exigir exclusivamente updatedAt dentro del rango", () => {
    const range = { fechaInicio: "2026-09-19", fechaFin: "2026-09-21" };

    expect(isOpportunityUpdatedWithinDateRange({
      createdAt: "2026-09-20T12:00:00.000Z",
      updatedAt: "2026-09-18T12:00:00.000Z",
    }, range)).toBe(false);
    expect(isOpportunityUpdatedWithinDateRange({
      createdAt: "2025-01-01T12:00:00.000Z",
      updatedAt: "2026-09-20T12:00:00.000Z",
    }, range)).toBe(true);
    expect(isOpportunityUpdatedWithinDateRange({
      createdAt: "2026-09-20T12:00:00.000Z",
    }, range)).toBe(false);
  });

  test("detiene paginacion por fecha cuando la pagina ya es anterior al rango", () => {
    expect(
      shouldStopDatePagination(
        [
          { id: "opp-1", createdAt: "2026-05-30T12:00:00.000Z" },
          { id: "opp-2", createdAt: "2026-05-29T12:00:00.000Z" },
        ],
        { fechaInicio: "2026-06-01" },
      ),
    ).toBe(true);

    expect(
      shouldStopDatePagination(
        [
          { id: "opp-1", createdAt: "2026-06-01T12:00:00.000Z" },
          { id: "opp-2", createdAt: "2026-05-29T12:00:00.000Z" },
        ],
        { fechaInicio: "2026-06-01" },
      ),
    ).toBe(false);

    expect(
      shouldStopDatePagination(
        [{
          id: "opp-actualizada",
          createdAt: "2025-01-01T12:00:00.000Z",
          updatedAt: "2026-06-01T12:00:00.000Z",
        }],
        { fechaInicio: "2026-06-01" },
      ),
    ).toBe(false);
  });

  test("usa la fecha de hoy cuando no llegan filtros de fecha", () => {
    const filters = resolveDateFilters({});

    expect(filters.fechaInicio).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(filters.fechaFin).toBe(filters.fechaInicio);
  });
});

describe("ghlService para reparto", () => {
  test.each([
    [401, "GHL_UNAUTHORIZED"],
    [403, "GHL_FORBIDDEN"],
    [429, "GHL_RATE_LIMITED"],
  ])("normaliza respuesta %i", (status, code) => {
    const error = normalizeGhlError({ response: { status, data: {}, headers: { "retry-after": "1" } } });
    expect(error.code).toBe(code);
    if (status === 429) expect(error.retryAfterMs).toBe(1000);
  });

  test("normaliza timeout sin exponer la respuesta", () => {
    expect(normalizeGhlError({ code: "ECONNABORTED" })).toMatchObject({ code: "GHL_CONNECTION_ERROR", message: "HighLevel no respondio a tiempo" });
  });

  test("pagina mas de cien usuarios", async () => {
    const first = Array.from({ length: 100 }, (_, i) => ({ id: `u${i}` }));
    const client = { request: jest.fn()
      .mockResolvedValueOnce({ data: { location: { companyId: "company" } } })
      .mockResolvedValueOnce({ data: { users: first } })
      .mockResolvedValueOnce({ data: { users: [{ id: "u100" }] } }) };
    const result = await fetchAllAssignableUsers(client, { locationId: "location" });
    expect(result).toHaveLength(101);
    expect(client.request).toHaveBeenCalledTimes(3);
  });

  test("pagina mas de cien oportunidades", async () => {
    const first = Array.from({ length: 100 }, (_, i) => ({ id: `o${i}` }));
    const client = { request: jest.fn()
      .mockResolvedValueOnce({ data: { opportunities: first } })
      .mockResolvedValueOnce({ data: { opportunities: [{ id: "o100" }] } }) };
    const result = await fetchOpportunitiesByStatus(client, { locationId: "location", pipelineId: "pipeline" }, "open");
    expect(result).toHaveLength(101);
    expect(client.request).toHaveBeenCalledTimes(2);
  });

  test("deduplica oportunidades entre paginas sin subestimar la carga completa", async () => {
    const first = Array.from({ length: 100 }, (_, i) => ({ id: `o${i}` }));
    const client = { request: jest.fn()
      .mockResolvedValueOnce({ data: { opportunities: first } })
      .mockResolvedValueOnce({ data: { opportunities: [{ id: "o99" }, { id: "o100" }] } }) };

    const onPage = jest.fn();
    const result = await fetchOpportunitiesByStatus(
      client,
      { locationId: "location", pipelineId: "pipeline", pipelineStageId: "whatsapp" },
      "open",
      {},
      { onPage },
    );

    expect(result).toHaveLength(101);
    expect(new Set(result.map((item) => item.id)).size).toBe(101);
    expect(client.request).toHaveBeenNthCalledWith(1, expect.objectContaining({
      params: expect.objectContaining({ pipelineStageId: "whatsapp" }),
    }));
    expect(onPage).toHaveBeenNthCalledWith(1, expect.objectContaining({ page: 1, examined: 100 }));
    expect(onPage).toHaveBeenNthCalledWith(2, expect.objectContaining({ page: 2, examined: 2 }));
  });

  test("recuerda el fallback snake_case y no repite un rechazo por cada pagina", async () => {
    const first = Array.from({ length: 100 }, (_, i) => ({ id: `o${i}` }));
    const invalidCamelCase = {
      response: {
        status: 400,
        data: { message: "property locationId should not exist" },
        headers: {},
      },
    };
    const client = { request: jest.fn()
      .mockRejectedValueOnce(invalidCamelCase)
      .mockResolvedValueOnce({ data: { opportunities: first } })
      .mockResolvedValueOnce({ data: { opportunities: [{ id: "o100" }] } }) };

    const result = await fetchOpportunitiesByStatus(
      client,
      { locationId: "location", pipelineId: "pipeline", pipelineStageId: "facebook" },
      "open",
    );

    expect(result).toHaveLength(101);
    expect(client.request).toHaveBeenCalledTimes(3);
    expect(client.request.mock.calls[1][0].params).toMatchObject({
      location_id: "location",
      pipeline_id: "pipeline",
      pipeline_stage_id: "facebook",
    });
    expect(client.request.mock.calls[2][0].params).toHaveProperty("location_id", "location");
    expect(client.request.mock.calls[2][0].params).not.toHaveProperty("locationId");
  });

  test("usa snake_case desde la primera pagina con la version 2023-02-21", async () => {
    const client = { request: jest.fn().mockResolvedValue({ data: { opportunities: [] } }) };

    await fetchOpportunitiesByStatus(client, {
      locationId: "location",
      pipelineId: "pipeline",
      pipelineStageId: "stage-no-contesta",
      apiVersion: "2023-02-21",
    }, "open");

    expect(client.request).toHaveBeenCalledTimes(1);
    expect(client.request.mock.calls[0][0].params).toMatchObject({
      location_id: "location",
      pipeline_id: "pipeline",
      pipeline_stage_id: "stage-no-contesta",
    });
    expect(client.request.mock.calls[0][0].params).not.toHaveProperty("pipelineStageId");
  });

  test("envia a HighLevel el rango de fechas solicitado", async () => {
    const client = { request: jest.fn().mockResolvedValue({ data: { opportunities: [] } }) };

    await fetchOpportunitiesByStatus(client, {
      locationId: "location",
      pipelineId: "pipeline",
      apiVersion: "2023-02-21",
    }, "open", {
      fechaInicio: "2026-09-19",
      fechaFin: "2026-09-21",
    });

    expect(client.request.mock.calls[0][0].params).toMatchObject({
      date: "09-19-2026",
      endDate: "09-21-2026",
    });
  });

  test("consulta oportunidades por updatedAt con filtros avanzados y pagina el resultado", async () => {
    const opportunity = (id) => ({
      id,
      pipelineId: "pipeline",
      pipelineStageId: "stage-no-contesta",
      status: "open",
      createdAt: "2025-01-01T12:00:00.000Z",
      updatedAt: "2026-09-20T12:00:00.000Z",
    });
    const firstPage = Array.from({ length: 100 }, (_, index) => opportunity(`opp-${index}`));
    const client = { request: jest.fn()
      .mockResolvedValueOnce({ data: { opportunities: firstPage, total: 101 } })
      .mockResolvedValueOnce({ data: { opportunities: [opportunity("opp-100")], total: 101 } }) };
    const onPage = jest.fn();

    const result = await fetchOpportunitiesByUpdatedDate(client, {
      locationId: "location",
      pipelineId: "pipeline",
      pipelineStageId: "stage-no-contesta",
    }, "open", {
      fechaInicio: "2026-09-19",
      fechaFin: "2026-09-21",
    }, { onPage });

    expect(result).toHaveLength(101);
    expect(client.request).toHaveBeenCalledTimes(2);
    expect(client.request.mock.calls[0][0]).toMatchObject({
      method: "POST",
      url: "/opportunities/search",
      headers: { Version: "v3" },
      data: {
        locationId: "location",
        page: 1,
        limit: 100,
        filters: expect.arrayContaining([
          { field: "pipeline_id", operator: "eq", value: "pipeline" },
          { field: "pipeline_stage_id", operator: "eq", value: "stage-no-contesta" },
          { field: "status", operator: "eq", value: "open" },
          {
            field: "date_updated",
            operator: "range",
            value: {
              gte: "2026-09-19T05:00:00.000Z",
              lte: "2026-09-22T04:59:59.999Z",
            },
          },
        ]),
      },
    });
    expect(client.request.mock.calls[1][0].data.page).toBe(2);
    expect(onPage).toHaveBeenCalledTimes(2);
  });

  test("reintenta snake_case si GHL ignora mayoritariamente el filtro camelCase", async () => {
    const unrelated = Array.from({ length: 100 }, (_, index) => ({
      id: `other-${index}`,
      pipelineId: "pipeline",
      pipelineStageId: "otra-etapa",
    }));
    const expected = {
      id: "target-1",
      pipelineId: "pipeline",
      pipelineStageId: "stage-no-contesta",
    };
    const client = { request: jest.fn()
      .mockResolvedValueOnce({ data: { opportunities: unrelated } })
      .mockResolvedValueOnce({ data: { opportunities: [expected] } }) };

    const result = await fetchOpportunitiesByStatus(client, {
      locationId: "location",
      pipelineId: "pipeline",
      pipelineStageId: "stage-no-contesta",
    }, "open");

    expect(result).toEqual([expected]);
    expect(client.request).toHaveBeenCalledTimes(2);
    expect(client.request.mock.calls[0][0].params).toHaveProperty("pipelineStageId", "stage-no-contesta");
    expect(client.request.mock.calls[1][0].params).toHaveProperty("pipeline_stage_id", "stage-no-contesta");
  });
});
