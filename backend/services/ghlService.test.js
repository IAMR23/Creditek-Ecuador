const {
  buildOpportunitiesMatrix,
  errorHasAnyMessage,
  extractCompanyIdFromLocation,
  filterOpportunitiesByDateRange,
  getNextPaginationCursor,
  getNextStartAfterId,
  resolveDateFilters,
  shouldStopDatePagination,
} = require("./ghlService");

describe("ghlService matrix builder", () => {
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

  test("filtra oportunidades por fecha de creacion", () => {
    const filtered = filterOpportunitiesByDateRange(
      [
        { id: "opp-1", createdAt: "2026-06-01T12:00:00.000Z" },
        { id: "opp-2", dateAdded: "2026-06-15T18:00:00.000Z" },
        { id: "opp-3", created_at: "2026-07-01T12:00:00.000Z" },
        { id: "opp-4", createdAt: null },
      ],
      {
        fechaInicio: "2026-06-01",
        fechaFin: "2026-06-30",
      },
    );

    expect(filtered.map((opportunity) => opportunity.id)).toEqual(["opp-1", "opp-2"]);
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
  });

  test("usa la fecha de hoy cuando no llegan filtros de fecha", () => {
    const filters = resolveDateFilters({});

    expect(filters.fechaInicio).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(filters.fechaFin).toBe(filters.fechaInicio);
  });
});
