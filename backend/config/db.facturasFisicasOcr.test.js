const {
  ensureFacturasFisicasOcrPreSyncSchema,
} = require("./db");

describe("pre-sync OCR de facturas fisicas", () => {
  test("agrega las columnas antes del sync y es idempotente", async () => {
    const existingColumns = {};
    const queryInterface = {
      showAllTables: jest.fn().mockResolvedValue(["facturas_fisicas"]),
      describeTable: jest.fn(async () => ({ ...existingColumns })),
      addColumn: jest.fn(async (_table, columnName) => {
        existingColumns[columnName] = { type: "TEST" };
      }),
    };

    await ensureFacturasFisicasOcrPreSyncSchema(queryInterface);

    expect(queryInterface.addColumn).toHaveBeenCalledTimes(12);
    expect(queryInterface.addColumn).toHaveBeenCalledWith(
      "facturas_fisicas",
      "ocrEstado",
      expect.objectContaining({
        allowNull: false,
        defaultValue: "NO_PROCESADO",
      }),
    );

    await ensureFacturasFisicasOcrPreSyncSchema(queryInterface);
    expect(queryInterface.addColumn).toHaveBeenCalledTimes(12);
  });

  test("no hace cambios si la tabla de Fase 1 aun no existe", async () => {
    const queryInterface = {
      showAllTables: jest.fn().mockResolvedValue([]),
      describeTable: jest.fn(),
      addColumn: jest.fn(),
    };

    await ensureFacturasFisicasOcrPreSyncSchema(queryInterface);

    expect(queryInterface.describeTable).not.toHaveBeenCalled();
    expect(queryInterface.addColumn).not.toHaveBeenCalled();
  });
});
