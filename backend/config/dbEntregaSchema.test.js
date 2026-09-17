const {
  sequelize,
  ensureEntregaOperacionSchema,
  ensureEntregaTipoSchema,
} = require("./db");

describe("esquema previo al arranque para entregas", () => {
  afterEach(() => jest.restoreAllMocks());

  test("crea y normaliza tipoEntrega antes de sequelize.sync", async () => {
    const query = jest.spyOn(sequelize, "query").mockResolvedValue([]);
    const queryInterface = {
      showAllTables: jest.fn().mockResolvedValue(["entregas"]),
      describeTable: jest.fn().mockResolvedValue({ id: {} }),
      addColumn: jest.fn().mockResolvedValue(undefined),
    };

    await ensureEntregaTipoSchema(queryInterface);

    expect(queryInterface.addColumn).toHaveBeenCalledWith(
      "entregas",
      "tipoEntrega",
      expect.objectContaining({ allowNull: true }),
    );

    const sql = query.mock.calls.map(([statement]) => statement).join("\n");
    expect(sql).toContain('SET "tipoEntrega" = \'Entrega\'');
    expect(sql).toContain('ALTER COLUMN "tipoEntrega" SET NOT NULL');
    expect(sql).toContain("entregas_tipo_entrega_check");
  });

  test("es idempotente cuando la columna ya existe", async () => {
    const query = jest.spyOn(sequelize, "query").mockResolvedValue([]);
    const queryInterface = {
      showAllTables: jest.fn().mockResolvedValue(["entregas"]),
      describeTable: jest.fn().mockResolvedValue({
        id: {},
        tipoEntrega: {},
      }),
      addColumn: jest.fn(),
    };

    await ensureEntregaTipoSchema(queryInterface);

    expect(queryInterface.addColumn).not.toHaveBeenCalled();
    expect(query).toHaveBeenCalledTimes(1);
  });

  test("no modifica bases donde la tabla entregas no existe", async () => {
    const query = jest.spyOn(sequelize, "query").mockResolvedValue([]);
    const queryInterface = {
      showAllTables: jest.fn().mockResolvedValue(["usuarios"]),
      describeTable: jest.fn(),
      addColumn: jest.fn(),
    };

    await ensureEntregaTipoSchema(queryInterface);

    expect(queryInterface.describeTable).not.toHaveBeenCalled();
    expect(queryInterface.addColumn).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });

  test("completa las columnas operativas antes de sincronizar modelos", async () => {
    const queryInterface = {
      showAllTables: jest
        .fn()
        .mockResolvedValue(["entregas", "usuario_agencia_entrega"]),
      describeTable: jest
        .fn()
        .mockResolvedValueOnce({ id: {} })
        .mockResolvedValueOnce({ id: {}, fecha_asignacion: {} }),
      addColumn: jest.fn().mockResolvedValue(undefined),
    };

    await ensureEntregaOperacionSchema(queryInterface);

    expect(queryInterface.addColumn).toHaveBeenCalledWith(
      "entregas",
      "version",
      expect.objectContaining({ allowNull: false, defaultValue: 0 }),
    );
    expect(queryInterface.addColumn).toHaveBeenCalledWith(
      "usuario_agencia_entrega",
      "fecha_desasignacion",
      expect.objectContaining({ allowNull: true }),
    );
  });

  test("no altera columnas operativas que ya existen", async () => {
    const queryInterface = {
      showAllTables: jest
        .fn()
        .mockResolvedValue(["entregas", "usuario_agencia_entrega"]),
      describeTable: jest
        .fn()
        .mockResolvedValueOnce({ id: {}, version: {} })
        .mockResolvedValueOnce({ id: {}, fecha_desasignacion: {} }),
      addColumn: jest.fn(),
    };

    await ensureEntregaOperacionSchema(queryInterface);

    expect(queryInterface.addColumn).not.toHaveBeenCalled();
  });
});
