const fs = require("fs");
const path = require("path");

describe("migracion de relacion Venta-Entrega", () => {
  const sql = fs.readFileSync(
    path.join(__dirname, "202609140005-link-ventas-entregas.sql"),
    "utf8",
  );

  test("crea ventaId nullable, su clave foranea y su indice", () => {
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "ventaId" INTEGER');
    expect(sql).toContain('FOREIGN KEY ("ventaId") REFERENCES ventas(id)');
    expect(sql).toContain("ON UPDATE CASCADE");
    expect(sql).toContain("ON DELETE SET NULL");
    expect(sql).toContain("CREATE INDEX IF NOT EXISTS entregas_venta_id_idx");
  });

  test("concilia solo entregas no vinculadas y coincidencias unicas", () => {
    expect(sql).toContain('WHERE entrega."ventaId" IS NULL');
    expect(sql).toContain("COUNT(DISTINCT venta.id) AS cantidad");
    expect(sql).toMatch(/candidata\.cantidad = 1/g);
    expect(sql).toContain("REGEXP_REPLACE");
    expect(sql).toContain("LENGTH(entrega.cedula_normalizada) IN (10, 13)");
  });

  test("incluye verificaciones y no elimina datos ni estructuras", () => {
    expect(sql).toContain("information_schema.columns");
    expect(sql).toContain("entregas_vinculadas");
    expect(sql).toContain("entregas_ambiguas");
    expect(sql).toContain("entregas_sin_coincidencia");
    expect(sql).not.toMatch(/\bDROP\b/i);
    expect(sql).not.toMatch(/\bDELETE\s+FROM\b/i);
  });
});
