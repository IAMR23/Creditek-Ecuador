const fs = require("fs");
const path = require("path");

test("la migracion agrega monto, plazo y prorrogas sin eliminar datos", () => {
  const sql = fs.readFileSync(path.join(__dirname, "202610200003-prestamos-monto-plazo-prorrogas.sql"), "utf8");
  expect(sql).toContain('ADD COLUMN IF NOT EXISTS "montoTotal" DECIMAL(12, 2)');
  expect(sql).toContain('ADD COLUMN IF NOT EXISTS "plazoMeses" INTEGER');
  expect(sql).toContain("ADD COLUMN IF NOT EXISTS prorrogas JSONB NOT NULL DEFAULT '[]'::jsonb");
  expect(sql).toContain("egresos_creditek_plazo_meses_rango");
  expect(sql).not.toMatch(/DROP\s+(COLUMN|TABLE)/i);
});
