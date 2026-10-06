const fs = require("fs");
const path = require("path");

describe("migracion de ejecuciones de difusion GHL", () => {
  const sql = fs.readFileSync(
    path.join(__dirname, "202609280003-create-ghl-difusion-ejecuciones.sql"),
    "utf8",
  );
  const schedulingSql = fs.readFileSync(
    path.join(__dirname, "202610020001-add-ghl-difusion-scheduled-at.sql"),
    "utf8",
  );
  const multipleExecutionsSql = fs.readFileSync(
    path.join(__dirname, "202610060005-allow-multiple-ghl-broadcasts.sql"),
    "utf8",
  );

  test("crea ejecuciones y detalles con cadencia por defecto", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS ghl_difusion_ejecuciones");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS ghl_difusion_ejecucion_detalles");
    expect(sql).toContain('"batchSize" INTEGER NOT NULL DEFAULT 3');
    expect(sql).toContain('"intervalMinutes" INTEGER NOT NULL DEFAULT 5');
    expect(sql).toContain('"scheduledAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()');
    expect(sql).toContain("DEFAULT 'regestion'");
    expect(sql).toContain("'skipped'");
  });

  test("agrega la fecha programada sin eliminar el historial existente", () => {
    expect(schedulingSql).toContain('ADD COLUMN IF NOT EXISTS "scheduledAt" TIMESTAMPTZ');
    expect(schedulingSql).toContain('SET "scheduledAt" = COALESCE("scheduledAt", "createdAt")');
    expect(schedulingSql).toContain('ALTER COLUMN "scheduledAt" SET NOT NULL');
    expect(schedulingSql).not.toMatch(/DROP\s+(TABLE|COLUMN)/i);
    expect(schedulingSql).not.toMatch(/DELETE\s+FROM/i);
  });

  test("la instalacion inicial permite varias difusiones activas", () => {
    expect(sql).toContain("ghl_difusion_ejecucion_activa_fecha_idx");
    expect(sql).not.toContain("CREATE UNIQUE INDEX");
    expect(sql).not.toMatch(/DROP\s+(TABLE|COLUMN)/i);
    expect(sql).not.toMatch(/DELETE\s+FROM/i);
  });

  test("habilita varias difusiones sin borrar campañas ni detalles", () => {
    expect(multipleExecutionsSql).toContain(
      "DROP INDEX IF EXISTS ghl_difusion_ejecucion_activa_unique",
    );
    expect(multipleExecutionsSql).toContain(
      "ghl_difusion_ejecucion_activa_fecha_idx",
    );
    expect(multipleExecutionsSql).not.toMatch(/DROP\s+(TABLE|COLUMN)/i);
    expect(multipleExecutionsSql).not.toMatch(/DELETE\s+FROM/i);
  });
});
