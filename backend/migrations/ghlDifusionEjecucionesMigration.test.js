const fs = require("fs");
const path = require("path");

describe("migracion de ejecuciones de difusion GHL", () => {
  const sql = fs.readFileSync(
    path.join(__dirname, "202609280003-create-ghl-difusion-ejecuciones.sql"),
    "utf8",
  );

  test("crea ejecuciones y detalles con cadencia por defecto", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS ghl_difusion_ejecuciones");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS ghl_difusion_ejecucion_detalles");
    expect(sql).toContain('"batchSize" INTEGER NOT NULL DEFAULT 3');
    expect(sql).toContain('"intervalMinutes" INTEGER NOT NULL DEFAULT 5');
    expect(sql).toContain("DEFAULT 'regestion'");
    expect(sql).toContain("'skipped'");
  });

  test("impide dos difusiones activas y no contiene operaciones destructivas", () => {
    expect(sql).toContain("ghl_difusion_ejecucion_activa_unique");
    expect(sql).not.toMatch(/DROP\s+(TABLE|COLUMN)/i);
    expect(sql).not.toMatch(/DELETE\s+FROM/i);
  });
});
