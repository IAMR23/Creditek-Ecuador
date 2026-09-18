const { sequelize, ensureTicketsTiPreSyncSchema } = require("./db");

describe("esquema previo al sync para Tickets de TI", () => {
  afterEach(() => jest.restoreAllMocks());

  test("agrega fechaInicio antes de que Sequelize intente crear su índice", async () => {
    const query = jest.spyOn(sequelize, "query").mockResolvedValue([]);
    const queryInterface = {
      showAllTables: jest.fn().mockResolvedValue(["sistemas_tickets"]),
      describeTable: jest.fn().mockResolvedValue({
        id: { type: "INTEGER" },
        fechaEstimada: { type: "DATE" },
      }),
      addColumn: jest.fn().mockResolvedValue(undefined),
    };

    await ensureTicketsTiPreSyncSchema(queryInterface);

    expect(queryInterface.addColumn).toHaveBeenCalledWith(
      "sistemas_tickets",
      "fechaInicio",
      expect.objectContaining({ allowNull: true }),
    );
    const sql = query.mock.calls.map(([statement]) => statement).join("\n");
    expect(sql).toContain("CREATE SEQUENCE IF NOT EXISTS sistemas_tickets_codigo_seq");
    expect(sql).toContain('ALTER COLUMN "fechaInicio" SET NOT NULL');
    expect(sql).toContain("sistemas_tickets_fechas_chk");
  });

  test("si la tabla no existe prepara sólo la secuencia y deja que sync la cree", async () => {
    const query = jest.spyOn(sequelize, "query").mockResolvedValue([]);
    const queryInterface = {
      showAllTables: jest.fn().mockResolvedValue([]),
      describeTable: jest.fn(),
      addColumn: jest.fn(),
    };

    await ensureTicketsTiPreSyncSchema(queryInterface);

    expect(query).toHaveBeenCalledTimes(1);
    expect(queryInterface.describeTable).not.toHaveBeenCalled();
    expect(queryInterface.addColumn).not.toHaveBeenCalled();
  });
});
