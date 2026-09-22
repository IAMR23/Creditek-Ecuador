const fs = require("fs");
const path = require("path");

describe("migracion de workflows programados GHL", () => {
  const sql = fs.readFileSync(path.join(__dirname, "202609210004-create-ghl-workflow-programaciones.sql"), "utf8");
  const hardeningSql = fs.readFileSync(path.join(__dirname, "202609210005-harden-ghl-workflow-idempotency.sql"), "utf8");
  const manualSql = fs.readFileSync(path.join(__dirname, "202609220001-add-ghl-workflow-manual-execution.sql"), "utf8");

  test("crea las tres entidades sin operaciones destructivas", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS ghl_workflow_programaciones");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS ghl_workflow_ejecuciones");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS ghl_workflow_ejecucion_detalles");
    expect(sql).not.toMatch(/DROP\s+(TABLE|COLUMN|TYPE)/i);
  });

  test("protege ventana, contacto e integridad de horario", () => {
    expect(sql).toContain("ghl_workflow_ejecucion_ventana_unique");
    expect(sql).toContain("ghl_workflow_detalle_contacto_unique");
    expect(sql).toContain("ghl_workflow_programacion_hora_check");
    expect(sql).toContain("America/Guayaquil");
  });

  test("marca una inscripcion en proceso para no repetir resultados ambiguos", () => {
    expect(sql).toContain("'processing'");
    expect(hardeningSql).toMatch(/ALTER TYPE[\s\S]+ADD VALUE IF NOT EXISTS 'processing'/);
    expect(hardeningSql).not.toMatch(/DROP\s+(TABLE|COLUMN|TYPE)/i);
  });

  test("permite ejecuciones manuales mediante una migracion incremental", () => {
    expect(sql).toContain("'scheduled', 'manual'");
    expect(manualSql).toMatch(/ALTER TYPE[\s\S]+ADD VALUE IF NOT EXISTS 'manual'/);
    expect(manualSql).not.toMatch(/DROP\s+(TABLE|COLUMN|TYPE)/i);
  });
});
