const service = require("./ghlBroadcastMessageService");

const row = (values) => ({
  ...values,
  toJSON() {
    const { toJSON, update, destroy, ...serialized } = this;
    return serialized;
  },
});

describe("ghlBroadcastMessageService", () => {
  test("normaliza nombre y valida el contenido", () => {
    expect(service.normalizePayload({
      nombre: "  Seguimiento   inicial ",
      contenido: "Hola, queremos ayudarte.",
    })).toEqual({
      nombre: "Seguimiento inicial",
      contenido: "Hola, queremos ayudarte.",
    });
    expect(() => service.normalizePayload({ nombre: "Ok", contenido: "Hola" }))
      .toThrow(expect.objectContaining({ code: "GHL_BROADCAST_SAVED_MESSAGE_NAME_INVALID" }));
    expect(() => service.normalizePayload({ nombre: "Mensaje valido", contenido: "" }))
      .toThrow(expect.objectContaining({ code: "GHL_BROADCAST_MESSAGE_REQUIRED" }));
  });

  test("crea un mensaje compartido con auditoria", async () => {
    const created = row({
      id: 4,
      nombre: "Recordatorio",
      contenido: "Hola, seguimos atentos a tu solicitud.",
      creadoPorId: 15,
      actualizadoPorId: 15,
    });
    const model = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(created),
    };

    const result = await service.createSavedMessage({
      nombre: "Recordatorio",
      contenido: "Hola, seguimos atentos a tu solicitud.",
    }, 15, { model });

    expect(model.create).toHaveBeenCalledWith(expect.objectContaining({
      creadoPorId: 15,
      actualizadoPorId: 15,
    }));
    expect(result).toMatchObject({ id: 4, nombre: "Recordatorio" });
  });

  test("actualiza el contenido conservando la auditoria", async () => {
    const saved = row({ id: 7, nombre: "Anterior", contenido: "Texto anterior" });
    saved.update = jest.fn(async (changes) => Object.assign(saved, changes));
    const model = {
      findByPk: jest.fn().mockResolvedValue(saved),
      findOne: jest.fn().mockResolvedValue(null),
    };

    const result = await service.updateSavedMessage(7, {
      nombre: "Seguimiento",
      contenido: "Nuevo texto",
    }, 22, { model });

    expect(saved.update).toHaveBeenCalledWith(expect.objectContaining({ actualizadoPorId: 22 }));
    expect(result).toMatchObject({ nombre: "Seguimiento", contenido: "Nuevo texto" });
  });
});
