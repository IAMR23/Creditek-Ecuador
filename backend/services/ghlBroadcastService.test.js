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

  test("normaliza numeros moviles ecuatorianos cargados sin duplicados", () => {
    expect(service.normalizeExternalPhoneNumbers([
      "0991234567",
      "+593 99 123 4567",
      "987654321",
    ])).toEqual(["+593991234567", "+593987654321"]);
    expect(service.normalizeExternalPhoneNumbers([
      "0999001413",
      "+593 999 900 1413",
      "+593 999 001 413",
    ])).toEqual(["+593999001413"]);
    expect(() => service.normalizeExternalPhoneNumbers(["022345678"]))
      .toThrow(expect.objectContaining({ code: "GHL_BROADCAST_EXTERNAL_PHONES_INVALID" }));
    expect(() => service.normalizeExternalPhoneNumbers(["+593 912 345 6789"]))
      .toThrow(expect.objectContaining({ code: "GHL_BROADCAST_EXTERNAL_PHONES_INVALID" }));
  });

  test("incluye numeros externos en la vista previa sin consultar ni crear contactos", async () => {
    const requestGhl = jest.fn();
    const result = await service.previewBroadcast({
      contactIds: [],
      phoneNumbers: ["0991234567", "+593987654321"],
      instanceIndexes: [1, 2],
      messages: ["Hola"],
    }, { requestGhl });

    expect(requestGhl).not.toHaveBeenCalled();
    expect(result).toMatchObject({ totalSelected: 2, totalEligible: 2, totalExcluded: 0 });
    expect(result.distribution.flatMap((group) => group.contacts)).toEqual([
      expect.objectContaining({ id: "external:+593991234567", phone: "+593991234567", external: true }),
      expect.objectContaining({ id: "external:+593987654321", phone: "+593987654321", external: true }),
    ]);
  });

  test("reutiliza o crea el contacto minimo de los numeros externos al confirmar", async () => {
    const requestGhl = jest.fn(async (_client, options) => ({
      contact: {
        id: `contact-${options.data.phone.slice(-4)}`,
        phone: options.data.phone,
      },
    }));

    const result = await service.resolveExternalRecipients({
      contactIds: ["crm-1"],
      phoneNumbers: ["+593 999 900 1413", "0987654321"],
    }, {
      getGhlConfig: () => ({ locationId: "location" }),
      createGhlClient: () => ({ client: true }),
      requestGhl,
    });

    expect(requestGhl).toHaveBeenCalledTimes(2);
    expect(requestGhl).toHaveBeenNthCalledWith(1, expect.anything(), expect.objectContaining({
      method: "POST",
      url: "/contacts/upsert",
      data: {
        locationId: "location",
        phone: "+593999001413",
        country: "EC",
        createNewIfDuplicateAllowed: false,
      },
    }));
    expect(result.contactIds).toEqual(["crm-1", "contact-1413", "contact-4321"]);
    expect(result.phoneNumbers).toEqual([]);
    expect(result.preloadedContacts.get("contact-1413")).toMatchObject({ phone: "+593999001413" });
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
          { field: "source", operator: "range", value: { from: "2026-09-01", to: "2026-09-30" } },
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

  test("envia el rango de creacion a GHL con limites de dias de Ecuador", async () => {
    const requestGhl = jest.fn().mockResolvedValue({ contacts: [], total: 0 });
    await service.listContacts(
      {
        page: 1,
        filters: [
          {
            field: "dateAdded",
            operator: "range",
            value: { from: "2026-09-01", to: "2026-09-30" },
          },
        ],
      },
      {
        getGhlConfig: () => ({ locationId: "location" }),
        createGhlClient: () => ({ client: true }),
        requestGhl,
      },
    );

    expect(requestGhl.mock.calls[0][1].data.filters).toEqual([
      {
        field: "dateAdded",
        operator: "range",
        value: {
          gt: "2026-09-01T04:59:59.999Z",
          lt: "2026-10-01T05:00:00.000Z",
        },
      },
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

  test("filtra por fecha en GHL antes de cruzar una etapa del pipeline", async () => {
    const fetchOpportunitiesByStatus = jest.fn().mockResolvedValue([
      { id: "opp-1", contactId: "1", source: "Facebook" },
      { id: "opp-2", contactId: "2", source: "Referido" },
    ]);
    const fetchContactsByIdsInBatches = jest.fn();
    const requestGhl = jest.fn().mockResolvedValue({
      contacts: [contact("2", { dateAdded: "2026-09-15T14:00:00.000Z" })],
      total: 1,
    });

    const result = await service.listContacts(
      {
        page: 1,
        pageSize: 10,
        filters: [
          { field: "pipelineStageId", operator: "eq", pipelineId: "pipeline-1", value: "stage-2" },
          { field: "dateAdded", operator: "range", value: { from: "2026-09-01", to: "2026-09-30" } },
        ],
      },
      {
        getGhlConfig: () => ({ locationId: "location" }),
        createGhlClient: () => ({ client: true }),
        fetchOpportunitiesByStatus,
        fetchContactsByIdsInBatches,
        requestGhl,
      },
    );

    expect(requestGhl).toHaveBeenCalledTimes(1);
    expect(requestGhl.mock.calls[0][1].data.filters).toEqual([
      expect.objectContaining({ field: "dateAdded", operator: "range" }),
    ]);
    expect(fetchContactsByIdsInBatches).not.toHaveBeenCalled();
    expect(result.contacts).toEqual([
      expect.objectContaining({ id: "2", source: "Referido", dateAdded: "2026-09-15T14:00:00.000Z" }),
    ]);
    expect(result.pagination.total).toBe(1);
  });

  test("exige acortar el rango si GHL supera su ventana segura de busqueda", async () => {
    const requestGhl = jest.fn().mockResolvedValue({
      contacts: Array.from({ length: 100 }, (_, index) => contact(String(index + 1))),
      total: 10001,
    });

    await expect(service.listContacts(
      {
        filters: [
          { field: "pipelineStageId", operator: "eq", pipelineId: "pipeline-1", value: "stage-2" },
          { field: "dateAdded", operator: "range", value: { from: "2026-01-01", to: "2026-09-30" } },
        ],
      },
      {
        getGhlConfig: () => ({ locationId: "location" }),
        createGhlClient: () => ({ client: true }),
        fetchOpportunitiesByStatus: jest.fn().mockResolvedValue([{ id: "opp-1", contactId: "1" }]),
        requestGhl,
      },
    )).rejects.toMatchObject({ code: "GHL_BROADCAST_DATE_RANGE_TOO_BROAD", statusCode: 422 });
    expect(requestGhl).toHaveBeenCalledTimes(1);
  });

  test("consulta en paralelo las paginas restantes del rango y cruza la etapa", async () => {
    const requestGhl = jest.fn(async (_client, options) => {
      const searchPage = options.data.page;
      const firstId = (searchPage - 1) * 100 + 1;
      const quantity = searchPage < 3 ? 100 : 50;
      return {
        contacts: Array.from({ length: quantity }, (_, index) => contact(String(firstId + index))),
        total: 250,
      };
    });

    const result = await service.listContacts(
      {
        page: 1,
        pageSize: 25,
        filters: [
          { field: "pipelineStageId", operator: "eq", pipelineId: "pipeline-1", value: "stage-2" },
          { field: "dateAdded", operator: "range", value: { from: "2026-09-01", to: "2026-09-30" } },
        ],
      },
      {
        getGhlConfig: () => ({ locationId: "location-pages" }),
        createGhlClient: () => ({ client: true }),
        fetchOpportunitiesByStatus: jest.fn().mockResolvedValue([{ id: "opp-225", contactId: "225" }]),
        requestGhl,
      },
    );

    expect(requestGhl).toHaveBeenCalledTimes(3);
    expect(requestGhl.mock.calls.map((call) => call[1].data.page).sort()).toEqual([1, 2, 3]);
    expect(result.contacts).toEqual([expect.objectContaining({ id: "225" })]);
  });

  test("reutiliza brevemente el cruce de fecha y etapa al cambiar de pagina", async () => {
    const fetchOpportunitiesByStatus = jest.fn().mockResolvedValue([
      { id: "opp-1", contactId: "1" },
      { id: "opp-2", contactId: "2" },
    ]);
    const requestGhl = jest.fn().mockResolvedValue({
      contacts: [contact("1"), contact("2")],
      total: 2,
    });
    const dependencies = {
      getGhlConfig: () => ({ locationId: "location-cache" }),
      createGhlClient: () => ({ client: true }),
      fetchOpportunitiesByStatus,
      requestGhl,
      enablePipelineDateCache: true,
    };
    const filters = [
      { field: "pipelineStageId", operator: "eq", pipelineId: "pipeline-cache", value: "stage-cache" },
      { field: "dateAdded", operator: "range", value: { from: "2026-09-01", to: "2026-09-30" } },
    ];

    const firstPage = await service.listContacts({ page: 1, pageSize: 1, filters }, dependencies);
    const secondPage = await service.listContacts({ page: 2, pageSize: 1, filters }, dependencies);

    expect(firstPage.contacts[0].id).toBe("1");
    expect(secondPage.contacts[0].id).toBe("2");
    expect(fetchOpportunitiesByStatus).toHaveBeenCalledTimes(1);
    expect(requestGhl).toHaveBeenCalledTimes(1);
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
