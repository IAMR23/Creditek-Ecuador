const service = require("./ghlBroadcastService");

const contact = (id, overrides = {}) => ({
  id,
  contactName: `Cliente ${id}`,
  phone: `+5939900000${String(id).padStart(2, "0")}`,
  dnd: false,
  ...overrides,
});

describe("ghlBroadcastService", () => {
  test("reparte 30 clientes en cinco instancias con seis por numero", () => {
    const contacts = Array.from({ length: 30 }, (_, index) => ({ id: String(index + 1) }));
    const distribution = service.buildBalancedDistribution(contacts, [1, 2, 3, 4, 5]);

    expect(distribution.map((group) => group.count)).toEqual([6, 6, 6, 6, 6]);
    expect(distribution.map((group) => group.marker)).toEqual([
      "{ WA#1 }",
      "{ WA#2 }",
      "{ WA#3 }",
      "{ WA#4 }",
      "{ WA#5 }",
    ]);
    expect(distribution.flatMap((group) => group.contacts).map((row) => row.id)).toEqual(
      contacts.map((row) => row.id),
    );
  });

  test("distribuye el sobrante sin superar una diferencia de uno", () => {
    const contacts = Array.from({ length: 32 }, (_, index) => ({ id: String(index + 1) }));
    expect(service.buildBalancedDistribution(contacts, [1, 2, 3, 4, 5]).map((group) => group.count))
      .toEqual([7, 7, 6, 6, 6]);
  });

  test("rechaza etiquetas WA manuales dentro del mensaje", () => {
    expect(() => service.validateMessage("Hola { WA#4 }")).toThrow(
      expect.objectContaining({ code: "GHL_BROADCAST_INSTANCE_MARKER_NOT_ALLOWED" }),
    );
  });

  test("valida hasta diez variantes para alternar", () => {
    expect(service.normalizeMessages({ messages: ["Mensaje uno", "Mensaje dos"] }))
      .toEqual(["Mensaje uno", "Mensaje dos"]);
    expect(() => service.normalizeMessages({ messages: Array(11).fill("Mensaje") }))
      .toThrow(expect.objectContaining({ code: "GHL_BROADCAST_MESSAGE_VARIANT_LIMIT" }));
  });

  test("selecciona Whatsapp y no el proveedor antiguo stevo", () => {
    const provider = service.selectMessageHubProvider([
      { _id: "old", name: "stevo", type: "SMS" },
      { _id: "current", name: "Whatsapp", type: "SMS" },
    ]);
    expect(provider).toMatchObject({ _id: "current", name: "Whatsapp" });
  });

  test("lista contactos paginados sin exponer campos personalizados", async () => {
    const requestGhl = jest.fn().mockResolvedValue({
      contacts: [
        contact("1", { email: "uno@example.com", customFields: [{ id: "secret", value: "value" }] }),
        contact("2", { phone: "", dnd: true }),
      ],
      total: 52,
    });

    const result = await service.listContacts(
      { query: "Cliente", page: 2, pageSize: 25 },
      {
        getGhlConfig: () => ({ locationId: "location" }),
        createGhlClient: () => ({ client: true }),
        requestGhl,
      },
    );

    expect(requestGhl).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      method: "POST",
      url: "/contacts/search",
      data: expect.objectContaining({ locationId: "location", page: 2, pageLimit: 25, query: "Cliente" }),
    }));
    expect(result.pagination).toMatchObject({ page: 2, total: 52, totalPages: 3 });
    expect(result.contacts[0]).not.toHaveProperty("customFields");
    expect(result.contacts[1]).toMatchObject({ canSend: false, blockedReason: "El contacto no tiene telefono" });
  });

  test("envia a GHL solo filtros avanzados permitidos", async () => {
    const requestGhl = jest.fn().mockResolvedValue({ contacts: [], total: 0 });
    await service.listContacts(
      {
        page: 1,
        filters: [
          { field: "source", operator: "eq", value: "Facebook" },
          { field: "tags", operator: "contains", value: "prospecto" },
          { field: "unsafe", operator: "eq", value: "ignorar" },
        ],
      },
      {
        getGhlConfig: () => ({ locationId: "location" }),
        createGhlClient: () => ({ client: true }),
        requestGhl,
      },
    );

    expect(requestGhl.mock.calls[0][1].data.filters).toEqual([
      { field: "source", operator: "eq", value: "Facebook" },
      { field: "tags", operator: "contains", value: "prospecto" },
    ]);
  });

  test("cruza la etapa del pipeline con los filtros del contacto", async () => {
    const fetchOpportunitiesByStatus = jest.fn().mockResolvedValue([
      { id: "opp-1", contactId: "1", source: "Facebook" },
      { id: "opp-2", contactId: "2", source: "Facebook" },
      { id: "opp-3", contactId: "1", source: "Facebook" },
    ]);
    const fetchContactsByIdsInBatches = jest.fn().mockResolvedValue(new Map([
      ["1", contact("1", { tags: ["prospecto"] })],
      ["2", contact("2", { tags: ["cliente"] })],
    ]));

    const result = await service.listContacts(
      {
        page: 1,
        pageSize: 10,
        filters: [
          { field: "pipelineStageId", operator: "eq", pipelineId: "pipeline-1", value: "stage-2" },
          { field: "tags", operator: "eq", value: "prospecto" },
        ],
      },
      {
        getGhlConfig: () => ({ locationId: "location" }),
        createGhlClient: () => ({ client: true }),
        fetchOpportunitiesByStatus,
        fetchContactsByIdsInBatches,
      },
    );

    expect(fetchOpportunitiesByStatus).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ pipelineId: "pipeline-1", pipelineStageId: "stage-2" }),
      "",
    );
    expect(fetchContactsByIdsInBatches).toHaveBeenCalledWith(expect.objectContaining({
      contactIds: ["1", "2"],
    }));
    expect(result.contacts.map((item) => item.id)).toEqual(["1"]);
    expect(result.pagination.total).toBe(1);
  });

  test("obtiene pipelines y etapas disponibles", async () => {
    const pipelines = await service.listPipelines({
      getGhlConfig: () => ({ locationId: "location" }),
      createGhlClient: () => ({ client: true }),
      fetchPipelines: jest.fn().mockResolvedValue([
        { id: "p-1", name: "Ventas", stages: [{ id: "s-1", name: "Nuevo" }] },
      ]),
    });

    expect(pipelines).toEqual([
      { id: "p-1", name: "Ventas", stages: [{ id: "s-1", name: "Nuevo" }] },
    ]);
  });

  test("obtiene las etiquetas disponibles directamente de GHL", async () => {
    const requestGhl = jest.fn().mockResolvedValue({
      tags: [
        { id: "2", name: "regestion" },
        { id: "1", name: "BDD UPHONE" },
        { id: "sin-nombre", name: "" },
      ],
    });

    const tags = await service.listLocationTags({
      getGhlConfig: () => ({ locationId: "location" }),
      createGhlClient: () => ({ client: true }),
      requestGhl,
    });

    expect(requestGhl).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      method: "GET",
      url: "/locations/location/tags",
      headers: { Version: "v3" },
    }));
    expect(tags).toEqual([
      { id: "1", name: "BDD UPHONE" },
      { id: "2", name: "regestion" },
    ]);
  });

  test("envia cada mensaje con la instancia asignada de Message Hub", async () => {
    const previousInterval = process.env.GHL_BROADCAST_INTERVAL_MS;
    process.env.GHL_BROADCAST_INTERVAL_MS = "0";
    const contacts = new Map([
      ["1", contact("1")],
      ["2", contact("2")],
      ["3", contact("3")],
      ["4", contact("4")],
    ]);
    const requestGhl = jest.fn(async (_client, options) => {
      if (options.method === "GET") {
        return {
          conversationChannel: {
            SMS: [{ conversationProvider: { _id: "provider-current", name: "Whatsapp", type: "SMS" } }],
          },
        };
      }
      return { messageId: `message-${options.data.contactId}` };
    });

    try {
      const result = await service.sendBroadcast(
        {
          confirmation: "ENVIAR",
          contactIds: ["1", "2", "3", "4"],
          instanceIndexes: [1, 2],
          message: "Hola, tenemos informacion para ti.",
        },
        {
          getGhlConfig: () => ({ locationId: "location" }),
          createGhlClient: () => ({ client: true }),
          fetchContactsByIdsInBatches: async () => contacts,
          requestGhl,
        },
      );

      const sendCalls = requestGhl.mock.calls.map((call) => call[1]).filter((options) => options.method === "POST");
      expect(result).toMatchObject({ status: "completed", sent: 4, failed: 0 });
      expect(sendCalls).toHaveLength(4);
      expect(sendCalls.slice(0, 2).every((options) => options.data.message.endsWith("{ WA#1 }"))).toBe(true);
      expect(sendCalls.slice(2).every((options) => options.data.message.endsWith("{ WA#2 }"))).toBe(true);
      expect(sendCalls[0].data).toMatchObject({ type: "SMS", conversationProviderId: "provider-current" });
      expect(sendCalls[0].maxRetries).toBe(0);
    } finally {
      if (previousInterval === undefined) delete process.env.GHL_BROADCAST_INTERVAL_MS;
      else process.env.GHL_BROADCAST_INTERVAL_MS = previousInterval;
    }
  });
});
