const fs = require("fs");
const path = require("path");

describe("migracion de ajustes manuales de comision y sancion", () => {
  test("agrega columnas anulables y restricciones no negativas", () => {
    const sql = fs.readFileSync(
      path.join(__dirname, "202611060001-nomina-comision-sancion-manuales.sql"),
      "utf8",
    );
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "comisionVentaManual" NUMERIC(12, 2)');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "sancionMetaManual" NUMERIC(12, 2)');
    expect(sql).toContain('CHECK ("comisionVentaManual" IS NULL OR "comisionVentaManual" >= 0)');
    expect(sql).toContain('CHECK ("sancionMetaManual" IS NULL OR "sancionMetaManual" >= 0)');
  });
});
