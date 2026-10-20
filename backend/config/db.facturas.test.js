const { sequelize, ensureFacturasPreSyncSchema } = require("./db");

describe("pre-sync de facturas", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("permite nulos y elimina relaciones antes del sync", async () => {
    const queryInterface = {
      showAllTables: jest.fn().mockResolvedValue(["facturas"]),
      describeTable: jest.fn().mockResolvedValue({
        fechaFactura: {},
        identificacionProveedor: {},
        proveedor: {},
        numeroFactura: {},
        subtotal: {},
        iva: {},
        total: {},
        formaPago: {},
        estado: {},
        enlaceFoto: {},
        observaciones: {},
        tipo: {},
        nombreArchivoJson: {},
        payloadOriginal: {},
        cargadoPorId: {},
      }),
    };
    const query = jest.spyOn(sequelize, "query").mockResolvedValue([]);

    await ensureFacturasPreSyncSchema(queryInterface);

    expect(queryInterface.describeTable).toHaveBeenCalledWith("facturas");
    expect(query).toHaveBeenCalledTimes(1);
    const sql = query.mock.calls[0][0];
    for (const field of [
      "fechaFactura",
      "identificacionProveedor",
      "proveedor",
      "numeroFactura",
      "subtotal",
      "iva",
      "total",
      "formaPago",
      "estado",
      "enlaceFoto",
      "observaciones",
      "tipo",
      "nombreArchivoJson",
      "payloadOriginal",
      "cargadoPorId",
    ]) {
      expect(sql).toContain(`ALTER COLUMN "${field}" DROP NOT NULL`);
    }
    expect(sql).toMatch(/contype = 'f'/i);
    expect(sql).toMatch(/DROP CONSTRAINT/i);
    expect(sql).not.toMatch(/\bDELETE\b|DROP\s+TABLE/i);
  });

  test("no ejecuta cambios si la tabla todavia no existe", async () => {
    const queryInterface = {
      showAllTables: jest.fn().mockResolvedValue([]),
      describeTable: jest.fn(),
    };
    const query = jest.spyOn(sequelize, "query").mockResolvedValue([]);

    await ensureFacturasPreSyncSchema(queryInterface);

    expect(queryInterface.describeTable).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });
});
