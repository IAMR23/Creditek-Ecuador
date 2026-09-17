const fs = require("fs");
const path = require("path");

describe("migracion de integridad de entregas", () => {
  const sql = fs.readFileSync(
    path.join(__dirname, "202609160001-entregas-integridad-historial.sql"),
    "utf8",
  );
  const sqlIndice = fs.readFileSync(
    path.join(__dirname, "202609160002-entregas-asignacion-activa-unica.sql"),
    "utf8",
  );

  test("diagnostica duplicados antes de crear el indice activo unico", () => {
    const precondicion = sqlIndice.indexOf("HAVING COUNT(*) > 1");
    const indice = sqlIndice.indexOf("usuario_agencia_entrega_una_activa_por_entrega");
    expect(precondicion).toBeGreaterThan(-1);
    expect(indice).toBeGreaterThan(precondicion);
    expect(sqlIndice).toContain("RAISE EXCEPTION");
    expect(sql).not.toContain("usuario_agencia_entrega_una_activa_por_entrega");
  });

  test("agrega version, fechas con semantica distinta e historial append-only", () => {
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 0");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS fecha_desasignacion");
    expect(sql).toContain("Fin de vigencia por cambio de responsable");
    expect(sql).toContain("Fecha en que la entrega alcanzo un estado operativo final");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS entrega_eventos");
    expect(sql).not.toMatch(/INSERT INTO entrega_eventos[\s\S]*SELECT/i);
  });

  test("incluye bitacora reversible de reconciliacion sin correcciones masivas", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS entrega_reconciliaciones");
    expect(sql).toContain('"asignacionesAnteriores" JSONB');
    expect(sql).not.toMatch(/UPDATE\s+entregas\s+SET\s+estado/i);
    expect(sql).not.toMatch(/UPDATE\s+usuario_agencia_entrega\s+SET\s+activo/i);
  });
});
