const {
  sequelize,
  ensureRequiredFeatureTables,
} = require("./db");

describe("esquemas requeridos por funcionalidades RVE", () => {
  afterEach(() => jest.restoreAllMocks());

  test("crea en orden las tablas faltantes sobre una base existente", async () => {
    const query = jest.spyOn(sequelize, "query").mockResolvedValue([]);
    const queryInterface = {
      showAllTables: jest.fn().mockResolvedValue(["agencias", "usuarios"]),
    };

    await ensureRequiredFeatureTables(queryInterface);

    const sql = query.mock.calls.map(([statement]) => statement).join("\n");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS mapa_comercial_zonas");
    expect(sql.indexOf("CREATE TABLE IF NOT EXISTS mapa_comercial_zonas"))
      .toBeLessThan(sql.indexOf("CREATE TABLE IF NOT EXISTS mapa_ubicaciones_normalizadas"));
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS ghl_difusion_ejecuciones");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS uphone_solicitudes");
  });

  test("no ejecuta migraciones cuando todas las tablas ya existen", async () => {
    const query = jest.spyOn(sequelize, "query").mockResolvedValue([]);
    const queryInterface = {
      showAllTables: jest.fn().mockResolvedValue([
        "agencias",
        "usuarios",
        "mapa_comercial_zonas",
        "mapa_ubicaciones_normalizadas",
        "ghl_difusion_listas",
        "ghl_difusion_ejecuciones",
        "ghl_difusion_ejecucion_detalles",
        "ghl_difusion_mensajes",
        "uphone_solicitudes",
      ]),
    };

    await ensureRequiredFeatureTables(queryInterface);

    expect(query).not.toHaveBeenCalled();
  });

  test("no crea tablas con llaves foraneas si faltan sus tablas base", async () => {
    const query = jest.spyOn(sequelize, "query").mockResolvedValue([]);
    const queryInterface = {
      showAllTables: jest.fn().mockResolvedValue([]),
    };

    await ensureRequiredFeatureTables(queryInterface);

    expect(query).not.toHaveBeenCalled();
  });
});
