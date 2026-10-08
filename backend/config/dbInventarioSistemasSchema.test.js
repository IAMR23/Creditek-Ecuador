const { sequelize, ensureInventarioSistemasSchema } = require("./db");

describe("esquema incremental de inventario de sistemas", () => {
  afterEach(() => jest.restoreAllMocks());

  test("agrega catálogo y fecha sin eliminar datos históricos", async () => {
    const query = jest.spyOn(sequelize, "query").mockResolvedValue([]);
    const queryInterface = {
      describeTable: jest.fn().mockResolvedValue({
        cantidad: {},
        precio: {},
      }),
      addColumn: jest.fn().mockResolvedValue(undefined),
      changeColumn: jest.fn().mockResolvedValue(undefined),
    };

    await ensureInventarioSistemasSchema(queryInterface, [
      "sistemas_inventarios",
    ]);

    expect(queryInterface.addColumn).toHaveBeenCalledWith(
      "sistemas_inventarios",
      "dispositivoMarcaId",
      expect.objectContaining({ allowNull: true }),
    );
    expect(queryInterface.addColumn).toHaveBeenCalledWith(
      "sistemas_inventarios",
      "modeloId",
      expect.objectContaining({ allowNull: true }),
    );
    expect(queryInterface.addColumn).toHaveBeenCalledWith(
      "sistemas_inventarios",
      "fechaIngreso",
      expect.objectContaining({ allowNull: true }),
    );

    const sql = query.mock.calls.map(([statement]) => statement).join("\n");
    expect(sql).toContain('COALESCE(DATE("createdAt"), CURRENT_DATE)');
    expect(sql).toContain("CREATE INDEX IF NOT EXISTS");
    expect(sql).not.toMatch(/DROP TABLE|DROP COLUMN|DELETE FROM/i);
    expect(queryInterface.changeColumn).toHaveBeenCalledWith(
      "sistemas_inventarios",
      "fechaIngreso",
      expect.objectContaining({ allowNull: false }),
    );
  });

  test("no cambia bases donde todavía no existe el inventario", async () => {
    const query = jest.spyOn(sequelize, "query").mockResolvedValue([]);
    const queryInterface = {
      describeTable: jest.fn(),
      addColumn: jest.fn(),
      changeColumn: jest.fn(),
    };

    await ensureInventarioSistemasSchema(queryInterface, ["usuarios"]);

    expect(queryInterface.describeTable).not.toHaveBeenCalled();
    expect(queryInterface.addColumn).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });
});
