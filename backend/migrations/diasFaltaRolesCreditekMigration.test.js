const fs = require("fs");
const path = require("path");

describe("migracion de dias de falta en nomina", () => {
  test("agrega el campo con cero por defecto, valida el rango y no elimina datos", () => {
    const sql = fs.readFileSync(
      path.join(__dirname, "202610200002-add-dias-falta-roles-creditek-ajustes.sql"),
      "utf8",
    );

    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "diasFalta" INTEGER NOT NULL DEFAULT 0');
    expect(sql).toContain("roles_creditek_ajustes_dias_falta_rango");
    expect(sql).toContain('CHECK ("diasFalta" BETWEEN 0 AND 30)');
    expect(sql).not.toMatch(/DROP\s+(COLUMN|TABLE)/i);
  });
});
