const fs = require("fs");
const path = require("path");

describe("migracion de atribucion comercial historica", () => {
  const sql = fs.readFileSync(
    path.join(__dirname, "202611060004-create-asignaciones-comerciales-historial.sql"),
    "utf8",
  );

  test("impide tramos solapados y conserva extremos inclusivos", () => {
    expect(sql).toContain("impedir_solapamiento_asignacion_comercial");
    expect(sql).toContain("daterange(");
    expect(sql).toContain("'[]'");
    expect(sql).toContain("vigenciaHasta");
  });

  test("la reconstruccion no atribuye responsables actuales sin evidencia", () => {
    expect(sql).toContain("'MIGRACION'");
    expect(sql).toContain('"requiereRevision", fuente');
    expect(sql).toContain("TRUE, 'MIGRACION'");
    expect(sql).toContain("siguiente_fecha - 1");
  });
});
