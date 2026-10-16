const fs = require("fs");
const path = require("path");

describe("migración de control semanal Masther Phone", () => {
  const sql = fs.readFileSync(
    path.join(__dirname, "202610160001-control-semanal-masther-phone.sql"),
    "utf8",
  );

  test("crea cierres, detalles y ajustes con restricciones anti duplicado", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS logistica_masther_phone_cierres");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS logistica_masther_phone_cierre_detalles");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS logistica_masther_phone_ajustes");
    expect(sql).toContain('UNIQUE ("periodoInicio")');
    expect(sql).toContain('UNIQUE ("cierreId", "modeloId", origen)');
    expect(sql).toContain('UNIQUE ("requestKey")');
    expect(sql).toContain('"periodoFinExclusivo" = "periodoInicio" + 7');
    expect(sql).toContain('"saldoFinal" = "saldoInicial" + ingresos - salidas + ajustes');
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS tipo");
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "cierreCorregidoId"');
  });

  test("no crea saldos, ejemplos ni elimina datos existentes", () => {
    expect(sql).not.toMatch(/\b(?:TRUNCATE|DELETE FROM|DROP TABLE)\b/i);
    expect(sql).not.toMatch(/INSERT\s+INTO\s+logistica_masther_phone_(?:cierres|cierre_detalles|ajustes)/i);
  });
});
