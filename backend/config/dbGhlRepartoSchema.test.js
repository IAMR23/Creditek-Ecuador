const {
  sequelize,
  ensureGhlAdvisorAvailabilitySchema,
  ensureGhlRepartoExecutionControlSchema,
} = require("./db");
const fs = require("fs");
const path = require("path");

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

  test("agrega intervalo y fecha de asignacion antes de sequelize.sync", async () => {
    const query = jest.spyOn(sequelize, "query").mockResolvedValue([]);
    await ensureGhlAdvisorAvailabilitySchema({
      showAllTables: jest.fn().mockResolvedValue([
        "ghl_reparto_configuraciones",
        "ghl_reparto_ejecucion_detalles",
      ]),
    });

    const sql = query.mock.calls.map(([statement]) => statement).join("\n");
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "intervaloMinutos"');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "assignedAt"');
    expect(sql).toContain('SET "assignedAt" = COALESCE');
  });

  test("no agrega disponibilidad si las tablas de reparto aun no existen", async () => {
    const query = jest.spyOn(sequelize, "query").mockResolvedValue([]);
    await ensureGhlAdvisorAvailabilitySchema({
      showAllTables: jest.fn().mockResolvedValue(["usuarios"]),
    });
    expect(query).not.toHaveBeenCalled();
  });

  test("la migracion incremental crea disponibilidad, auditoria e indices", () => {
    const sql = fs.readFileSync(
      path.join(__dirname, "../migrations/202609090001-add-ghl-advisor-availability.sql"),
      "utf8",
    );
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS ghl_asesor_vinculos");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS ghl_asesor_disponibilidad_historial");
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "intervaloMinutos"');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "assignedAt"');
    expect(sql).toContain("ghl_asesor_vinculo_disponibilidad_idx");
  });
});
