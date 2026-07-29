const {
  buildPautasPerformance,
  clearPautasCaches,
  extractSourceIdFromContact,
  extractSourceIdFromOpportunity,
  fetchAllOpportunityStatuses,
  fetchContactsByIdsInBatches,
  getOrLoadPautasData,
  getOpportunityContactId,
  getOpportunityStatus,
  mapWithConcurrency,
  resolvePautasDateFilters,
  resolveSourceIdsForOpportunities,
} = require("./ghlService");

beforeEach(() => {
  clearPautasCaches();
});

const pipeline = {
  id: "pipeline-1",
  name: "Ventas Meta",
  stages: [
    { id: "aplica", name: "APLICA" },
    { id: "costa-aplica", name: "Costa aplica" },
    { id: "oriente-aplica", name: "oriente-aplica" },
    { id: "no-aplica", name: "No Aplica" },
    { id: "costa-no-aplica", name: "COSTA NO APLICA" },
    { id: "oriente-no-aplica", name: "Oriente No Aplica" },
    { id: "no-contesta", name: "No Contesta" },
    { id: "venta", name: "Venta" },
  ],
};

describe("ghlService rendimiento de pautas", () => {
  test("agrupa por Source ID y calcula etapas, grupos, porcentajes y totales", () => {
    const longSourceId = "120251578589580222";
    const report = buildPautasPerformance({
      pipelineId: "pipeline-1",
      pipelines: [pipeline],
      sourceIdsByContact: new Map([
        ["contact-1", longSourceId],
        ["contact-2", "222"],
      ]),
      opportunities: [
        {
          id: "opp-1",
          pipelineId: "pipeline-1",
          pipelineStageId: "aplica",
          contactId: "contact-1",
          status: "open",
        },
        {
          id: "opp-2",
          pipelineId: "pipeline-1",
          pipelineStageId: "costa-aplica",
          contactId: "contact-1",
          status: "won",
        },
        {
          id: "opp-3",
          pipelineId: "pipeline-1",
          pipelineStageId: "no-contesta",
          contactId: "contact-1",
          status: "lost",
        },
        {
          id: "opp-4",
          pipelineId: "pipeline-1",
          pipelineStageId: "venta",
          contactId: "contact-1",
          status: "abandoned",
        },
        {
          id: "opp-5",
          pipelineId: "pipeline-1",
          pipelineStageId: "no-aplica",
          contactId: "contact-2",
        },
        {
          id: "opp-6",
          pipelineId: "pipeline-1",
          pipelineStageId: "venta",
        },
        {
          id: "opp-2",
          pipelineId: "pipeline-1",
          pipelineStageId: "no-aplica",
          contactId: "contact-1",
        },
      ],
    });

    expect(report.columns.map((column) => column.id)).toEqual(
      pipeline.stages.map((stage) => stage.id),
    );
    expect(report.rows).toHaveLength(3);
    expect(report.rows[0]).toMatchObject({
      sourceId: longSourceId,
      label: longSourceId,
      total: 4,
      aplicanTotal: 2,
      noAplicanTotal: 0,
      noContestaTotal: 1,
      tasaAplicacion: 50,
      tasaNoContesta: 25,
      tasaNoAplicacion: 0,
      openTotal: 1,
      wonTotal: 1,
      lostTotal: 1,
      abandonedTotal: 1,
      tasaWon: 25,
      tasaLost: 25,
      tasaAbandoned: 25,
      values: {
        aplica: 1,
        "costa-aplica": 1,
        "no-contesta": 1,
        venta: 1,
      },
      statusValues: {
        open: 1,
        won: 1,
        lost: 1,
        abandoned: 1,
      },
    });
    expect(typeof report.rows[0].sourceId).toBe("string");
    expect(report.rows.find((row) => row.sourceId === "Sin Source ID")).toMatchObject({
      total: 1,
      values: {
        venta: 1,
      },
    });
    expect(report.totals).toMatchObject({
      total: 6,
      totalOportunidades: 6,
      totalSourceIds: 2,
      aplicanTotal: 2,
      noAplicanTotal: 1,
      noContestaTotal: 1,
      openTotal: 1,
      wonTotal: 1,
      lostTotal: 1,
      abandonedTotal: 1,
      tasaAplicacion: 33.33,
      tasaNoContesta: 16.67,
      tasaNoAplicacion: 16.67,
      tasaWon: 16.67,
      tasaLost: 16.67,
      tasaAbandoned: 16.67,
    });
    expect(
      Object.values(report.totals.values).reduce(
        (sum, value) => sum + value,
        0,
      ),
    ).toBe(report.totals.total);
    expect(
      Object.values(report.totals.statusValues).reduce(
        (sum, value) => sum + value,
        0,
      ),
    ).toBe(report.totals.total);
    expect(report.meta).toMatchObject({
      sourceIdCount: 2,
      rowCount: 3,
      opportunityCount: 6,
    });
  });

  test("reconoce nombres de etapas sin depender de mayusculas, tildes o guiones", () => {
    const report = buildPautasPerformance({
      pipelineId: "pipeline-1",
      pipelines: [
        {
          id: "pipeline-1",
          stages: [
            { id: "s1", name: "COSTA APLICA" },
            { id: "s2", name: "Oriente-aplica" },
            { id: "s3", name: "Costa no aplica" },
            { id: "s4", name: "ORIENTE-NO-APLICA" },
            { id: "s5", name: "No Contésta" },
          ],
        },
      ],
      sourceIdsByContact: new Map([["contact-1", "source-1"]]),
      opportunities: ["s1", "s2", "s3", "s4", "s5"].map((stageId, index) => ({
        id: `opp-${index}`,
        pipelineId: "pipeline-1",
        pipelineStageId: stageId,
        contactId: "contact-1",
      })),
    });

    expect(report.rows[0]).toMatchObject({
      aplicanTotal: 2,
      noAplicanTotal: 2,
      noContestaTotal: 1,
    });
  });

  test("extrae Source ID por key, por nombre y por ID de custom field", () => {
    const definitions = [
      {
        id: "field-meta",
        fieldKey: "contact.meta_source_id",
        name: "Meta Source ID",
      },
      {
        id: "field-source",
        fieldKey: "contact.other_field",
        name: "Source ID",
      },
    ];

    expect(
      extractSourceIdFromOpportunity(
        {
          contact: {
            customFields: [
              { key: "sourceId", field_value: "secondary" },
              { key: "meta_source_id", field_value: "primary" },
            ],
          },
        },
        definitions,
      ),
    ).toBe("primary");

    expect(
      extractSourceIdFromContact(
        {
          customFields: [
            { id: "field-source", value: "from-name" },
            { id: "field-meta", value: "987654321098765432109876" },
          ],
        },
        definitions,
      ),
    ).toBe("987654321098765432109876");
  });

  test("obtiene contactId desde las variantes soportadas", () => {
    expect(getOpportunityContactId({ contactId: "contact-1" })).toBe("contact-1");
    expect(getOpportunityContactId({ contact: { id: "contact-2" } })).toBe(
      "contact-2",
    );
    expect(
      getOpportunityContactId({
        relations: [{ relationType: "Contact", objectId: "contact-3" }],
      }),
    ).toBe("contact-3");
    expect(getOpportunityContactId({})).toBe("");
  });

  test("aplica filtros de etapa y Source ID sin ocultar columnas del pipeline", () => {
    const report = buildPautasPerformance({
      pipelineId: "pipeline-1",
      pipelines: [pipeline],
      etapa: "APLICA",
      sourceId: "222",
      sourceIdsByContact: new Map([
        ["contact-1", "111"],
        ["contact-2", "1200222"],
      ]),
      opportunities: [
        {
          id: "opp-1",
          pipelineId: "pipeline-1",
          pipelineStageId: "aplica",
          contactId: "contact-1",
        },
        {
          id: "opp-2",
          pipelineId: "pipeline-1",
          pipelineStageId: "aplica",
          contactId: "contact-2",
        },
        {
          id: "opp-3",
          pipelineId: "pipeline-1",
          pipelineStageId: "venta",
          contactId: "contact-2",
        },
      ],
    });

    expect(report.columns).toHaveLength(pipeline.stages.length);
    expect(report.rows).toHaveLength(1);
    expect(report.rows[0]).toMatchObject({
      sourceId: "1200222",
      total: 1,
      aplicanTotal: 1,
    });
  });

  test("normaliza las variantes del estado y usa unknown cuando falta", () => {
    expect(getOpportunityStatus({ status: " WON " })).toBe("won");
    expect(getOpportunityStatus({ opportunityStatus: "Lost" })).toBe("lost");
    expect(getOpportunityStatus({ state: "ABANDONED" })).toBe("abandoned");
    expect(getOpportunityStatus({ statusName: " Follow Up " })).toBe(
      "follow up",
    );
    expect(
      getOpportunityStatus({
        status: " ",
        opportunityStatus: "Open",
      }),
    ).toBe("open");
    expect(getOpportunityStatus({})).toBe("unknown");
  });

  test("cuenta etapa y estado como dimensiones independientes sin etapas ficticias", () => {
    const report = buildPautasPerformance({
      pipelineId: "pipeline-1",
      pipelines: [pipeline],
      sourceIdsByContact: new Map([["contact-1", "source-1"]]),
      opportunities: [
        {
          id: "opp-won",
          pipelineId: "pipeline-1",
          pipelineStageId: "venta",
          contactId: "contact-1",
          status: "won",
        },
        {
          id: "opp-lost",
          pipelineId: "pipeline-1",
          pipelineStageId: "aplica",
          contactId: "contact-1",
          status: "lost",
        },
        {
          id: "opp-open",
          pipelineId: "pipeline-1",
          pipelineStageId: "no-aplica",
          contactId: "contact-1",
          status: "open",
        },
        {
          id: "opp-extra",
          pipelineId: "pipeline-1",
          pipelineStageId: "venta",
          contactId: "contact-1",
          opportunityStatus: "Qualified",
        },
        {
          id: "opp-unknown",
          pipelineId: "pipeline-1",
          pipelineStageId: "venta",
          contactId: "contact-1",
        },
        {
          id: "opp-won",
          pipelineId: "pipeline-1",
          pipelineStageId: "no-aplica",
          contactId: "contact-1",
          status: "lost",
        },
      ],
    });

    expect(report.columns.map((column) => column.id)).toEqual(
      pipeline.stages.map((stage) => stage.id),
    );
    expect(report.columns.map((column) => column.id)).not.toEqual(
      expect.arrayContaining(["won", "lost"]),
    );
    expect(report.statusColumns.map((column) => column.id)).toEqual([
      "open",
      "won",
      "lost",
      "abandoned",
      "qualified",
      "unknown",
    ]);
    expect(report.rows[0]).toMatchObject({
      total: 5,
      values: {
        venta: 3,
        aplica: 1,
        "no-aplica": 1,
      },
      statusValues: {
        open: 1,
        won: 1,
        lost: 1,
        abandoned: 0,
        qualified: 1,
        unknown: 1,
      },
      aplicanTotal: 1,
      noAplicanTotal: 1,
      openTotal: 1,
      wonTotal: 1,
      lostTotal: 1,
      abandonedTotal: 0,
      tasaWon: 20,
      tasaLost: 20,
      tasaAbandoned: 0,
    });
    expect(
      Object.values(report.rows[0].values).reduce(
        (sum, value) => sum + value,
        0,
      ),
    ).toBe(report.rows[0].total);
    expect(
      Object.values(report.rows[0].statusValues).reduce(
        (sum, value) => sum + value,
        0,
      ),
    ).toBe(report.rows[0].total);
  });

  test("filtra etapa y estado de forma independiente, incluidos otros estados", () => {
    const baseOptions = {
      pipelineId: "pipeline-1",
      pipelines: [pipeline],
      sourceIdsByContact: new Map([["contact-1", "source-1"]]),
      opportunities: [
        {
          id: "opp-1",
          pipelineId: "pipeline-1",
          pipelineStageId: "venta",
          contactId: "contact-1",
          status: "won",
        },
        {
          id: "opp-2",
          pipelineId: "pipeline-1",
          pipelineStageId: "aplica",
          contactId: "contact-1",
          status: "lost",
        },
        {
          id: "opp-3",
          pipelineId: "pipeline-1",
          pipelineStageId: "venta",
          contactId: "contact-1",
          state: "qualified",
        },
        {
          id: "opp-4",
          pipelineId: "pipeline-1",
          pipelineStageId: "venta",
          contactId: "contact-1",
        },
      ],
    };

    const lostInAplica = buildPautasPerformance({
      ...baseOptions,
      etapa: "aplica",
      status: "LOST",
    });
    const wonInNoAplica = buildPautasPerformance({
      ...baseOptions,
      etapa: "no-aplica",
      status: "won",
    });
    const otherStatuses = buildPautasPerformance({
      ...baseOptions,
      status: "otros",
    });

    expect(lostInAplica.totals).toMatchObject({
      total: 1,
      lostTotal: 1,
      noAplicanTotal: 0,
      tasaLost: 100,
    });
    expect(wonInNoAplica.totals.total).toBe(0);
    expect(otherStatuses.totals).toMatchObject({
      total: 2,
      openTotal: 0,
      wonTotal: 0,
      lostTotal: 0,
      abandonedTotal: 0,
    });
    expect(otherStatuses.totals.statusValues).toMatchObject({
      qualified: 1,
      unknown: 1,
    });
  });

  test("consulta todos los estados en una sola paginacion, filtra fechas y deduplica IDs", async () => {
    const responsesByStatus = {
      open: [
        {
          id: "opp-open",
          status: "open",
          createdAt: "2026-07-05T12:00:00.000Z",
        },
      ],
      won: [
        {
          id: "opp-won",
          status: "won",
          createdAt: "2026-07-10T12:00:00.000Z",
        },
      ],
      lost: [
        {
          id: "opp-open",
          status: "lost",
          createdAt: "2026-07-05T12:00:00.000Z",
        },
        {
          id: "opp-outside",
          status: "lost",
          createdAt: "2026-06-20T12:00:00.000Z",
        },
      ],
      abandoned: [
        {
          id: "opp-abandoned",
          status: "abandoned",
          createdAt: "2026-07-20T12:00:00.000Z",
        },
      ],
    };
    const client = {
      request: jest.fn(() =>
        Promise.resolve({
          data: {
            opportunities: Object.values(responsesByStatus).flat(),
          },
        }),
      ),
    };

    const opportunities = await fetchAllOpportunityStatuses(
      client,
      {
        locationId: "location-1",
        pipelineId: "pipeline-1",
      },
      {
        fechaInicio: "2026-07-01",
        fechaFin: "2026-07-31",
      },
    );

    expect(client.request).toHaveBeenCalledTimes(1);
    expect(opportunities.map((opportunity) => opportunity.id)).toEqual([
      "opp-open",
      "opp-won",
      "opp-abandoned",
    ]);
    expect(opportunities.map((opportunity) => opportunity.status)).toEqual([
      "open",
      "won",
      "abandoned",
    ]);
  });

  test("consulta los cuatro estados por separado si GHL exige status", async () => {
    const client = {
      request: jest.fn(({ params }) => {
        if (!params.status) {
          return Promise.reject({
            response: {
              status: 422,
              data: {
                message: "status is required",
              },
            },
          });
        }

        return Promise.resolve({
          data: {
            opportunities: [
              {
                id: `opp-${params.status}`,
                status: params.status,
                createdAt: "2026-07-10T12:00:00.000Z",
              },
            ],
          },
        });
      }),
    };

    const opportunities = await fetchAllOpportunityStatuses(
      client,
      {
        locationId: "location-1",
        pipelineId: "pipeline-1",
      },
      {
        fechaInicio: "2026-07-01",
        fechaFin: "2026-07-31",
      },
    );

    expect(client.request).toHaveBeenCalledTimes(5);
    expect(opportunities.map((opportunity) => opportunity.status)).toEqual([
      "open",
      "won",
      "lost",
      "abandoned",
    ]);
  });

  test("detiene la consulta unica cuando la pagina ya es anterior al rango", async () => {
    const client = {
      request: jest.fn(() =>
        Promise.resolve({
          data: {
            opportunities: [
              {
                id: "old-open",
                status: "open",
                createdAt: "2026-06-30T12:00:00.000Z",
              },
            ],
            meta: {
              nextPageUrl:
                "https://services.leadconnectorhq.com/opportunities/search?startAfterId=next-open",
            },
          },
        }),
      ),
    };

    const opportunities = await fetchAllOpportunityStatuses(
      client,
      {
        locationId: "location-1",
        pipelineId: "pipeline-1",
      },
      {
        fechaInicio: "2026-07-01",
        fechaFin: "2026-07-31",
      },
    );

    expect(opportunities).toEqual([]);
    expect(client.request).toHaveBeenCalledTimes(1);
  });

  test("consulta contactos por lote y conserva sus custom fields", async () => {
    const client = {
      request: jest.fn().mockResolvedValue({
        data: {
          contacts: [
            {
              id: "contact-1",
              customFields: [
                {
                  key: "meta_source_id",
                  value: "source-1",
                },
              ],
            },
            {
              id: "contact-2",
              customFields: [
                {
                  key: "meta_source_id",
                  value: "source-2",
                },
              ],
            },
          ],
        },
      }),
    };

    const contactsById = await fetchContactsByIdsInBatches({
      client,
      locationId: "location-1",
      contactIds: ["contact-1", "contact-2"],
    });

    expect(client.request).toHaveBeenCalledTimes(1);
    expect(client.request).toHaveBeenCalledWith({
      method: "POST",
      url: "/contacts/search",
      data: {
        locationId: "location-1",
        page: 1,
        pageLimit: 2,
        filters: [
          {
            field: "id",
            operator: "eq",
            value: ["contact-1", "contact-2"],
          },
        ],
      },
    });
    expect(contactsById.get("contact-1")?.customFields).toHaveLength(1);
    expect(contactsById.get("contact-2")?.customFields).toHaveLength(1);
  });

  test("resuelve varios Source ID con una sola consulta agrupada", async () => {
    const client = {
      request: jest.fn().mockResolvedValue({
        data: {
          contacts: [
            {
              id: "contact-1",
              customFields: [
                {
                  key: "meta_source_id",
                  value: "source-1",
                },
              ],
            },
            {
              id: "contact-2",
              customFields: [
                {
                  key: "meta_source_id",
                  value: "source-2",
                },
              ],
            },
          ],
        },
      }),
    };

    const sourceIdsByContact = await resolveSourceIdsForOpportunities({
      client,
      locationId: "location-1",
      opportunities: [
        { id: "opp-1", contactId: "contact-1" },
        { id: "opp-2", contactId: "contact-2" },
      ],
    });

    expect(client.request).toHaveBeenCalledTimes(1);
    expect(sourceIdsByContact.get("contact-1")).toBe("source-1");
    expect(sourceIdsByContact.get("contact-2")).toBe("source-2");
  });

  test("consulta cada contacto una sola vez y tolera contactos inaccesibles", async () => {
    const definitions = [
      {
        id: "field-meta",
        fieldKey: "contact.meta_source_id",
        name: "Meta Source ID",
      },
    ];
    const client = {
      request: jest.fn(({ url }) => {
        if (url === "/contacts/contact-1") {
          return Promise.resolve({
            data: {
              contact: {
                customFields: [
                  {
                    id: "field-meta",
                    value: "12345678901234567890",
                  },
                ],
              },
            },
          });
        }

        return Promise.reject({
          response: {
            status: 404,
            data: {
              message: "Contact not found",
            },
          },
        });
      }),
    };
    const warningSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    const sourceIdsByContact = await resolveSourceIdsForOpportunities({
      client,
      customFieldDefinitions: definitions,
      opportunities: [
        { id: "opp-1", contactId: "contact-1" },
        { id: "opp-2", contact: { id: "contact-1" } },
        { id: "opp-3", contactId: "contact-2" },
        { id: "opp-4" },
      ],
    });

    expect(client.request).toHaveBeenCalledTimes(2);
    expect(sourceIdsByContact.get("contact-1")).toBe("12345678901234567890");
    expect(sourceIdsByContact.get("contact-2")).toBeNull();
    expect(warningSpy).toHaveBeenCalledTimes(1);
    warningSpy.mockRestore();
  });

  test("reintenta un contacto solamente cuando HighLevel responde 429", async () => {
    const previousMinimumInterval =
      process.env.GHL_CONTACT_MIN_INTERVAL_MS;
    process.env.GHL_CONTACT_MIN_INTERVAL_MS = "0";
    try {
      const client = {
        request: jest
          .fn()
          .mockRejectedValueOnce({
            response: {
              status: 429,
              headers: {
                "retry-after": "0",
              },
              data: {
                message: "Rate limit exceeded",
              },
            },
          })
          .mockResolvedValueOnce({
            data: {
              contact: {
                customFields: [
                  {
                    key: "meta_source_id",
                    value: "source-after-retry",
                  },
                ],
              },
            },
          }),
      };

      const sourceIdsByContact = await resolveSourceIdsForOpportunities({
        client,
        opportunities: [{ id: "opp-1", contactId: "contact-1" }],
      });

      expect(client.request).toHaveBeenCalledTimes(2);
      expect(sourceIdsByContact.get("contact-1")).toBe("source-after-retry");
    } finally {
      if (previousMinimumInterval === undefined) {
        delete process.env.GHL_CONTACT_MIN_INTERVAL_MS;
      } else {
        process.env.GHL_CONTACT_MIN_INTERVAL_MS = previousMinimumInterval;
      }
    }
  });

  test("propaga el limite 429 para poder usar el reporte en cache", async () => {
    const previousMinimumInterval =
      process.env.GHL_CONTACT_MIN_INTERVAL_MS;
    const previousMaximumRetries =
      process.env.GHL_CONTACT_MAX_RETRIES;
    process.env.GHL_CONTACT_MIN_INTERVAL_MS = "0";
    process.env.GHL_CONTACT_MAX_RETRIES = "0";
    const warningSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    try {
      const client = {
        request: jest.fn().mockRejectedValue({
          response: {
            status: 429,
            headers: {
              "retry-after": "0",
            },
            data: {
              message: "Rate limit exceeded",
            },
          },
        }),
      };

      await expect(
        resolveSourceIdsForOpportunities({
          client,
          opportunities: [{ id: "opp-1", contactId: "contact-1" }],
        }),
      ).rejects.toMatchObject({
        code: "GHL_RATE_LIMITED",
        statusCode: 503,
      });
    } finally {
      warningSpy.mockRestore();

      if (previousMinimumInterval === undefined) {
        delete process.env.GHL_CONTACT_MIN_INTERVAL_MS;
      } else {
        process.env.GHL_CONTACT_MIN_INTERVAL_MS = previousMinimumInterval;
      }

      if (previousMaximumRetries === undefined) {
        delete process.env.GHL_CONTACT_MAX_RETRIES;
      } else {
        process.env.GHL_CONTACT_MAX_RETRIES = previousMaximumRetries;
      }
    }
  });

  test("reutiliza el Source ID del contacto entre solicitudes", async () => {
    const firstClient = {
      request: jest.fn().mockResolvedValue({
        data: {
          contact: {
            customFields: [
              {
                key: "meta_source_id",
                value: "source-cached",
              },
            ],
          },
        },
      }),
    };
    const secondClient = {
      request: jest.fn(),
    };
    const opportunities = [{ id: "opp-1", contactId: "contact-cached" }];

    const firstResult = await resolveSourceIdsForOpportunities({
      client: firstClient,
      opportunities,
    });
    const secondResult = await resolveSourceIdsForOpportunities({
      client: secondClient,
      opportunities,
    });

    expect(firstResult.get("contact-cached")).toBe("source-cached");
    expect(secondResult.get("contact-cached")).toBe("source-cached");
    expect(firstClient.request).toHaveBeenCalledTimes(1);
    expect(secondClient.request).not.toHaveBeenCalled();
  });

  test("reutiliza los datos del reporte mientras la cache esta vigente", async () => {
    const loader = jest.fn().mockResolvedValue({
      opportunities: [{ id: "opp-1" }],
    });

    const firstResult = await getOrLoadPautasData({
      cacheKey: "range-1",
      loader,
    });
    const secondResult = await getOrLoadPautasData({
      cacheKey: "range-1",
      loader,
    });

    expect(loader).toHaveBeenCalledTimes(1);
    expect(firstResult.cache.hit).toBe(false);
    expect(secondResult.cache).toMatchObject({
      hit: true,
      stale: false,
    });
    expect(secondResult.data).toBe(firstResult.data);
  });

  test("comparte una sola carga entre solicitudes simultaneas", async () => {
    let finishLoader;
    const loader = jest.fn(
      () =>
        new Promise((resolve) => {
          finishLoader = resolve;
        }),
    );

    const firstRequest = getOrLoadPautasData({
      cacheKey: "range-concurrent",
      loader,
    });
    const secondRequest = getOrLoadPautasData({
      cacheKey: "range-concurrent",
      loader,
    });
    await Promise.resolve();
    finishLoader({ opportunities: [{ id: "opp-1" }] });

    const [firstResult, secondResult] = await Promise.all([
      firstRequest,
      secondRequest,
    ]);

    expect(loader).toHaveBeenCalledTimes(1);
    expect(firstResult.data).toBe(secondResult.data);
    expect(secondResult.cache).toMatchObject({
      hit: true,
      coalesced: true,
    });
  });

  test("usa datos vencidos si HighLevel responde con limite temporal", async () => {
    const previousTtl = process.env.GHL_PAUTAS_CACHE_TTL_MS;
    const previousStaleTtl = process.env.GHL_PAUTAS_STALE_TTL_MS;
    process.env.GHL_PAUTAS_CACHE_TTL_MS = "0";
    process.env.GHL_PAUTAS_STALE_TTL_MS = "60000";

    try {
      const cachedData = {
        opportunities: [{ id: "opp-cached" }],
      };
      await getOrLoadPautasData({
        cacheKey: "range-stale",
        loader: jest.fn().mockResolvedValue(cachedData),
      });

      const staleResult = await getOrLoadPautasData({
        cacheKey: "range-stale",
        loader: jest.fn().mockRejectedValue({
          code: "GHL_RATE_LIMITED",
        }),
      });

      expect(staleResult.data).toBe(cachedData);
      expect(staleResult.cache).toMatchObject({
        hit: true,
        stale: true,
        fallbackReason: "GHL_RATE_LIMITED",
      });
    } finally {
      if (previousTtl === undefined) {
        delete process.env.GHL_PAUTAS_CACHE_TTL_MS;
      } else {
        process.env.GHL_PAUTAS_CACHE_TTL_MS = previousTtl;
      }

      if (previousStaleTtl === undefined) {
        delete process.env.GHL_PAUTAS_STALE_TTL_MS;
      } else {
        process.env.GHL_PAUTAS_STALE_TTL_MS = previousStaleTtl;
      }
    }
  });

  test("limita la concurrencia de tareas", async () => {
    let active = 0;
    let maxActive = 0;

    const results = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (value) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return value * 2;
    });

    expect(results).toEqual([2, 4, 6, 8, 10]);
    expect(maxActive).toBeLessThanOrEqual(2);
  });

  test("valida el rango de fechas y conserva el valor por defecto de hoy", () => {
    const defaultFilters = resolvePautasDateFilters({});
    expect(defaultFilters.fechaInicio).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(defaultFilters.fechaFin).toBe(defaultFilters.fechaInicio);

    expect(() =>
      resolvePautasDateFilters({
        fechaInicio: "fecha-invalida",
        fechaFin: "2026-07-31",
      }),
    ).toThrow("El rango de fechas no es valido");

    expect(() =>
      resolvePautasDateFilters({
        fechaInicio: "2026-02-31",
        fechaFin: "2026-03-01",
      }),
    ).toThrow("El rango de fechas no es valido");

    expect(() =>
      resolvePautasDateFilters({
        fechaInicio: "2026-08-01",
        fechaFin: "2026-07-31",
      }),
    ).toThrow("El rango de fechas no es valido");
  });
});
