const service = require("./ghlBroadcastCategoryService");

const row = (values) => ({
  ...values,
  update: jest.fn(async function update(changes) { Object.assign(this, changes); }),
  destroy: jest.fn().mockResolvedValue(undefined),
  toJSON() { return { ...this, update: undefined, destroy: undefined, toJSON: undefined }; },
});

describe("ghlBroadcastCategoryService", () => {
  test("crea una categoria normalizada con auditoria", async () => {
    const created = row({ id: 3, nombre: "Seguimiento", creadoPorId: 9, actualizadoPorId: 9 });
    const model = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(created),
    };

    await expect(service.createCategory({ nombre: "  Seguimiento  " }, 9, { model }))
      .resolves.toMatchObject({ id: 3, nombre: "Seguimiento" });
    expect(model.create).toHaveBeenCalledWith({
      nombre: "Seguimiento",
      creadoPorId: 9,
      actualizadoPorId: 9,
    });
  });

  test("rechaza nombres duplicados sin distinguir mayusculas", async () => {
    const model = { findOne: jest.fn().mockResolvedValue({ id: 2 }) };
    await expect(service.createCategory({ nombre: "Ventas" }, 9, { model }))
      .rejects.toMatchObject({ code: "GHL_BROADCAST_CATEGORY_DUPLICATE", statusCode: 409 });
  });
});
