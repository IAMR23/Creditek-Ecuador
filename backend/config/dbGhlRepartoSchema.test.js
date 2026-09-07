const { sequelize, ensureGhlRepartoExecutionControlSchema } = require("./db");

describe("esquema previo al arranque para reparto GHL", () => {
  afterEach(() => jest.restoreAllMocks());

  test("agrega campos de control antes de sequelize.sync", async () => {
    const query = jest.spyOn(sequelize, "query").mockResolvedValue([]);
    await ensureGhlRepartoExecutionControlSchema({
      showAllTables: jest.fn().mockResolvedValue([
        "ghl_reparto_ejecuciones",
        "ghl_reparto_ejecucion_detalles",
      ]),
    });

    const sql = query.mock.calls.map(([statement]) => statement).join("\n");
    expect(sql).toContain('"pauseRequestedAt"');
    expect(sql).toContain('"heartbeatAt"');
    expect(sql).toContain('"processedCount"');
    expect(sql).toContain('"attemptCount"');
    expect(sql).toContain("pause_requested");
  });

  test("no altera bases donde el modulo aun no existe", async () => {
    const query = jest.spyOn(sequelize, "query").mockResolvedValue([]);
    await ensureGhlRepartoExecutionControlSchema({
      showAllTables: jest.fn().mockResolvedValue(["usuarios"]),
    });
    expect(query).not.toHaveBeenCalled();
  });
});
