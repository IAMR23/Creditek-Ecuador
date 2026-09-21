const fs = require("fs");
const path = require("path");

describe("migracion de workflows programados GHL", () => {
  const sql = fs.readFileSync(path.join(__dirname, "202609210004-create-ghl-workflow-programaciones.sql"), "utf8");

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
});
