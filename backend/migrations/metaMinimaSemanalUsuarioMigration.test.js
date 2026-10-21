const fs = require("fs");
const path = require("path");

describe("migracion de meta minima semanal por vendedor", () => {
  test("agrega una meta individual opcional y no elimina datos", () => {
    const sql = fs.readFileSync(
      path.join(__dirname, "202610200001-add-meta-minima-semanal-usuarios.sql"),
      "utf8",
    );

    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "metaMinimaSemanal" INTEGER');
    expect(sql).toContain("usuarios_meta_minima_semanal_no_negativa");
    expect(sql).toContain('"metaMinimaSemanal" IS NULL OR "metaMinimaSemanal" >= 0');
    expect(sql).not.toMatch(/DROP\s+(COLUMN|TABLE)/i);
  });
});
