const fs = require("fs");
const path = require("path");

describe("migracion del inventario Masther Phone", () => {
  const sql = fs.readFileSync(
    path.join(__dirname, "202610080004-create-logistica-masther-phone.sql"),
    "utf8",
  );

  test("crea persistencia incremental, restricciones e indices", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS logistica_masther_phone_ingresos");
    expect(sql).toContain(
      "CREATE TABLE IF NOT EXISTS logistica_masther_phone_conciliaciones",
    );
    expect(sql).toContain('UNIQUE ("requestKey")');
    expect(sql).toContain('UNIQUE ("modeloId", "semanaInicio")');
    expect(sql).toContain("CHECK (cantidad > 0)");
    expect(sql).toContain("CHECK (bodega IN ('CREDITEK', 'PROVEEDOR'))");
    expect(sql).toContain('CHECK ("stockCreditek" >= 0)');
    expect(sql).toContain("CREATE INDEX IF NOT EXISTS");
  });

  test("no contiene operaciones destructivas", () => {
    expect(sql).not.toMatch(/\b(?:DROP TABLE|TRUNCATE|DELETE FROM)\b/i);
  });
});
