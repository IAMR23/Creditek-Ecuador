const fs = require("fs");
const path = require("path");

describe("migracion de edicion de ingresos Masther Phone", () => {
  const sql = fs.readFileSync(
    path.join(__dirname, "202610080005-add-edicion-ingresos-masther-phone.sql"),
    "utf8",
  );

  test("agrega auditoria e indice de consulta por periodo", () => {
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "actualizadoPorId" INTEGER');
    expect(sql).toContain("logistica_masther_phone_ingresos_actualizado_por_fk");
    expect(sql).toContain("logistica_masther_phone_ingresos_fecha_idx");
  });

  test("no elimina ni vacia informacion", () => {
    expect(sql).not.toMatch(/\b(?:DROP TABLE|TRUNCATE|DELETE FROM)\b/i);
  });
});
