const {
  sequelize,
  ensureGhlAdvisorAvailabilitySchema,
  ensureGhlRepartoCapacitySchema,
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
    expect(sql).toContain("refresh_non_management");
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

  test("la migracion de refresco agrega el modo sin alterar configuraciones existentes", () => {
    const sql = fs.readFileSync(
      path.join(__dirname, "../migrations/202609110001-add-ghl-refresh-non-management-mode.sql"),
      "utf8",
    );
    expect(sql).toContain("ADD VALUE IF NOT EXISTS 'refresh_non_management'");
    expect(sql).toContain("SELECT enumlabel");
  });

  test("agrega limite y contadores de capacidad antes de sequelize.sync", async () => {
    const query = jest.spyOn(sequelize, "query").mockResolvedValue([]);
    await ensureGhlRepartoCapacitySchema({
      showAllTables: jest.fn().mockResolvedValue([
        "ghl_reparto_configuraciones",
        "ghl_reparto_ejecuciones",
      ]),
    });
    const sql = query.mock.calls.map(([statement]) => statement).join("\n");
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "maxPendientesPorAsesor" INTEGER');
    expect(sql).toContain('SET "maxPendientesPorAsesor" = 10');
    expect(sql).toContain('ALTER COLUMN "maxPendientesPorAsesor" SET NOT NULL');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "totalPendientesCapacidad"');
  });

  test("la migracion incremental asigna 10 a configuraciones existentes y no recrea tablas", () => {
    const sql = fs.readFileSync(
      path.join(__dirname, "../migrations/202609140001-add-ghl-max-pendientes-por-asesor.sql"),
      "utf8",
    );
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "maxPendientesPorAsesor" INTEGER');
    expect(sql).toContain('SET "maxPendientesPorAsesor" = 10');
    expect(sql).toContain('ALTER COLUMN "maxPendientesPorAsesor" SET DEFAULT 10');
    expect(sql).toContain('CHECK ("maxPendientesPorAsesor" BETWEEN 1 AND 1000)');
    expect(sql).not.toMatch(/DROP TABLE|CREATE TABLE/i);
  });

  test("la migracion del webhook crea idempotencia persistente sin guardar telefono ni payload", () => {
    const sql = fs.readFileSync(
      path.join(__dirname, "../migrations/202609140002-create-ghl-reparto-webhook-eventos.sql"),
      "utf8",
    );
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS ghl_reparto_webhook_eventos");
    expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS ghl_reparto_webhook_eventos_idempotency_unique');
    expect(sql).toContain('"idempotencyKey" VARCHAR(64) NOT NULL');
    expect(sql).not.toMatch(/phone|payload/i);
    expect(sql).not.toMatch(/DROP TABLE/i);
  });
});
