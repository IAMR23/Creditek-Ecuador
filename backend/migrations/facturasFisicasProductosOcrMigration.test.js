const fs = require("fs");
const path = require("path");

describe("migracion aditiva de productos OCR", () => {
  const sql = fs.readFileSync(
    path.join(
      __dirname,
      "202608190002-create-facturas-fisicas-productos-ocr.sql",
    ),
    "utf8",
  );

  test("crea tabla, relaciones, estado e indices esperados", () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS facturas_fisicas_productos_ocr/i);
    expect(sql).toMatch(/REFERENCES facturas_fisicas\(id\)/i);
    expect(sql).toMatch(/DETECTADO/);
    expect(sql).toMatch(/CONFIRMADO/);
    expect(sql).toMatch(/DESCARTADO/);
    expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS/i);
  });

  test("no contiene instrucciones destructivas", () => {
    expect(sql).not.toMatch(/\b(?:DROP|TRUNCATE|DELETE)\b/i);
  });

  test("agrega precision exacta y JSON variable sin alterar columnas existentes", () => {
    const additiveSql = fs.readFileSync(
      path.join(
        __dirname,
        "202608190003-add-precision-and-additional-data-productos-ocr.sql",
      ),
      "utf8",
    );
    expect(additiveSql).toMatch(/ADD COLUMN IF NOT EXISTS "precioUnitarioExacto" NUMERIC\(18, 6\)/i);
    expect(additiveSql).toMatch(/ADD COLUMN IF NOT EXISTS "datosAdicionales" JSONB/i);
    expect(additiveSql).not.toMatch(/\b(?:DROP|TRUNCATE|DELETE)\b/i);
    expect(additiveSql).not.toMatch(/ALTER\s+COLUMN/i);
  });
});
