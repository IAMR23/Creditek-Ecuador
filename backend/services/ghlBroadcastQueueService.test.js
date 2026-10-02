const service = require("./ghlBroadcastQueueService");

const executionRow = (values = {}) => ({
  id: 12,
  estado: "pending",
  mensaje: "Hola cliente",
  instanceIndexes: [1, 2],
  batchSize: 3,
  intervalMinutes: 5,
  tagName: "regestion",
  total: 4,
  processed: 0,
  sent: 0,
  failed: 0,
  tagged: 0,
  tagFailed: 0,
  excluded: [],
  scheduledAt: new Date("2026-09-28T15:00:00.000Z"),
  nextBatchAt: new Date("2026-09-28T15:00:00.000Z"),
  createdAt: new Date("2026-09-28T14:55:00.000Z"),
  startedAt: null,
  update: jest.fn(async function update(changes) {
    Object.assign(this, changes);
    return this;
  }),
  toJSON() { return { ...this }; },
  ...values,
});

describe("ghlBroadcastQueueService", () => {
  test("usa por defecto tres mensajes cada cinco minutos", () => {
    expect(service.normalizeRate({})).toEqual({ batchSize: 3, intervalMinutes: 5 });
    expect(service.normalizeRate({ batchSize: 5, intervalMinutes: 7 }))
      .toEqual({ batchSize: 5, intervalMinutes: 7 });
    expect(() => service.normalizeRate({ batchSize: 0, intervalMinutes: 5 }))
      .toThrow(expect.objectContaining({ code: "GHL_BROADCAST_RATE_INVALID" }));
  });

  test("valida la fecha programada y permite ejecucion inmediata", () => {
    const now = new Date("2026-10-02T15:00:00.000Z");
    expect(service.normalizeScheduledAt(undefined, now)).toEqual(now);
    expect(service.normalizeScheduledAt("2026-10-02T16:30:00.000Z", now))
      .toEqual(new Date("2026-10-02T16:30:00.000Z"));
    expect(() => service.normalizeScheduledAt("2026-10-02T14:00:00.000Z", now))
      .toThrow(expect.objectContaining({ code: "GHL_BROADCAST_SCHEDULE_PAST" }));
    expect(() => service.normalizeScheduledAt("fecha-invalida", now))
      .toThrow(expect.objectContaining({ code: "GHL_BROADCAST_SCHEDULE_INVALID" }));
  });

  test("selecciona como maximo un mensaje por extension en cada lote", () => {
    const details = [
      { id: 1, instanceIndex: 1, estado: "pending" },
      { id: 2, instanceIndex: 1, estado: "pending" },
      { id: 3, instanceIndex: 1, estado: "pending" },
      { id: 4, instanceIndex: 2, estado: "pending" },
      { id: 5, instanceIndex: 2, estado: "pending" },
      { id: 6, instanceIndex: 3, estado: "pending" },
    ];

    expect(service.selectBalancedBatchDetails(details, [1, 2, 3], 3).map((detail) => detail.id))
      .toEqual([1, 4, 6]);
    expect(service.selectBalancedBatchDetails(details, [1, 2, 3], 20).map((detail) => detail.id))
      .toEqual([1, 4, 6]);
  });

  test("rota primero hacia las extensiones con menos mensajes procesados", () => {
    const details = [
      { id: 1, instanceIndex: 1, estado: "sent" },
      { id: 2, instanceIndex: 1, estado: "pending" },
      { id: 3, instanceIndex: 2, estado: "sent" },
      { id: 4, instanceIndex: 2, estado: "pending" },
      { id: 5, instanceIndex: 3, estado: "pending" },
    ];

    expect(service.selectBalancedBatchDetails(details, [1, 2, 3], 2).map((detail) => detail.id))
      .toEqual([5, 2]);
  });

  test("crea una ejecucion persistente con contactos repartidos", async () => {
    const execution = executionRow({ batchSize: 5, intervalMinutes: 7 });
    const Ejecucion = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(execution),
    };
    const Detalle = { bulkCreate: jest.fn().mockResolvedValue([]) };
    const previewBroadcast = jest.fn().mockResolvedValue({
      totalEligible: 2,
      excluded: [],
      distribution: [
        { instanceIndex: 1, contacts: [{ id: "c1", name: "Uno" }] },
        { instanceIndex: 2, contacts: [{ id: "c2", name: "Dos" }] },
      ],
    });

    const result = await service.createExecution({
      confirmation: "ENVIAR",
      contactIds: ["c1", "c2"],
      instanceIndexes: [1, 2],
      messages: ["Hola cliente", "Seguimos atentos"],
      batchSize: 5,
      intervalMinutes: 7,
      scheduledAt: "2026-10-02T16:30:00.000Z",
    }, 9, {
      Ejecucion,
      Detalle,
      previewBroadcast,
      transaction: (callback) => callback({}),
      now: new Date("2026-10-02T15:00:00.000Z"),
    });

    expect(Ejecucion.create).toHaveBeenCalledWith(expect.objectContaining({
      batchSize: 5,
      intervalMinutes: 7,
      tagName: "regestion",
      creadoPorId: 9,
      mensaje: "Hola cliente",
      mensajes: ["Hola cliente", "Seguimos atentos"],
      scheduledAt: new Date("2026-10-02T16:30:00.000Z"),
      nextBatchAt: new Date("2026-10-02T16:30:00.000Z"),
    }), expect.anything());
    expect(Detalle.bulkCreate).toHaveBeenCalledWith([
      expect.objectContaining({ contactId: "c1", instanceIndex: 1, mensaje: "Hola cliente" }),
      expect.objectContaining({ contactId: "c2", instanceIndex: 2, mensaje: "Seguimos atentos" }),
    ], expect.anything());
    expect(result).toMatchObject({ id: "12", batchSize: 5, intervalMinutes: 7 });
  });

  test("lista el historial paginado con usuario y fecha programada", async () => {
    const row = executionRow({ creadoPor: { id: 9, nombre: "Administrador" } });
    const Ejecucion = {
      findAndCountAll: jest.fn().mockResolvedValue({ count: 1, rows: [row] }),
    };

    const result = await service.listExecutions({ page: 1, pageSize: 10 }, { Ejecucion });

    expect(Ejecucion.findAndCountAll).toHaveBeenCalledWith(expect.objectContaining({
      limit: 10,
      offset: 0,
      order: [["createdAt", "DESC"]],
    }));
    expect(result).toMatchObject({
      executions: [expect.objectContaining({
        id: "12",
        scheduledAt: new Date("2026-09-28T15:00:00.000Z"),
        creadoPor: { id: 9, nombre: "Administrador" },
      })],
      pagination: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
    });
  });

  test("no reclama lotes antes de la fecha programada", async () => {
    const now = new Date("2026-10-02T15:00:00.000Z");
    const execution = executionRow({ nextBatchAt: new Date("2026-10-02T16:00:00.000Z") });
    const Ejecucion = { findByPk: jest.fn().mockResolvedValue(execution) };
    const Detalle = { findAll: jest.fn() };

    const result = await service.claimBatch(12, now, {
      Ejecucion,
      Detalle,
      transaction: (callback) => callback({ LOCK: { UPDATE: "UPDATE" } }),
    });

    expect(result).toBeNull();
    expect(Detalle.findAll).not.toHaveBeenCalled();
  });

  test("envia y agrega regestion a cada contacto reclamado", async () => {
    const now = new Date("2026-09-28T15:00:00.000Z");
    const execution = executionRow({ nextBatchAt: now });
    const detail = {
      id: 1,
      contactId: "c1",
      contactName: "Uno",
      instanceIndex: 2,
      mensaje: "Variante asignada",
      estado: "pending",
    };
    const Ejecucion = {
      findByPk: jest.fn().mockResolvedValue(execution),
      update: jest.fn().mockResolvedValue([1]),
    };
    const Detalle = {
      findAll: jest.fn().mockResolvedValue([detail]),
      update: jest.fn().mockResolvedValue([1]),
      count: jest.fn()
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(0),
    };
    const requestGhl = jest.fn()
      .mockResolvedValueOnce({ messageId: "message-1" })
      .mockResolvedValueOnce({ tags: ["regestion"] });
    const transaction = (callback) => callback({ LOCK: { UPDATE: "UPDATE" } });

    await service.processBatch(12, now, {
      Ejecucion,
      Detalle,
      transaction,
      requestGhl,
      getMessageHubProvider: async () => ({
        client: {},
        provider: { id: "provider" },
      }),
    });

    expect(requestGhl).toHaveBeenNthCalledWith(1, expect.anything(), expect.objectContaining({
      url: "/conversations/messages",
      data: expect.objectContaining({ message: "Variante asignada\n\n{ WA#2 }" }),
      maxRetries: 0,
    }));
    expect(requestGhl).toHaveBeenNthCalledWith(2, expect.anything(), expect.objectContaining({
      url: "/contacts/c1/tags",
      data: { tags: ["regestion"] },
    }));
    expect(Detalle.update).toHaveBeenCalledWith(expect.objectContaining({
      estado: "sent",
      tagStatus: "tagged",
    }), expect.anything());
  });

  test("no agrega regestion cuando el mensaje no fue enviado", async () => {
    const now = new Date("2026-09-28T15:00:00.000Z");
    const execution = executionRow({ nextBatchAt: now });
    const detail = { id: 1, contactId: "c1", contactName: "Uno", instanceIndex: 2, estado: "pending" };
    const Ejecucion = {
      findByPk: jest.fn().mockResolvedValue(execution),
      update: jest.fn().mockResolvedValue([1]),
    };
    const Detalle = {
      findAll: jest.fn().mockResolvedValue([detail]),
      update: jest.fn().mockResolvedValue([1]),
      count: jest.fn()
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0),
    };
    const requestGhl = jest.fn().mockRejectedValueOnce(new Error("Envio rechazado"));
    const transaction = (callback) => callback({ LOCK: { UPDATE: "UPDATE" } });

    await service.processBatch(12, now, {
      Ejecucion,
      Detalle,
      transaction,
      requestGhl,
      getMessageHubProvider: async () => ({
        client: {},
        provider: { id: "provider" },
      }),
    });

    expect(requestGhl).toHaveBeenCalledTimes(1);
    expect(requestGhl).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      url: "/conversations/messages",
    }));
    expect(Detalle.update).toHaveBeenCalledWith(expect.objectContaining({
      estado: "failed",
      tagStatus: "skipped",
      tagError: "No se agrego la etiqueta porque el mensaje no fue enviado",
    }), expect.anything());
  });
});
