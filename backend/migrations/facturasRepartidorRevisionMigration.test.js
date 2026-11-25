const fs = require("fs");
const path = require("path");

describe("migracion de facturas subidas por repartidor", () => {
  const sql = fs.readFileSync(
    path.join(__dirname, "202611250001-facturas-repartidor-revision.sql"),
    "utf8",
  );

  test("agrega trazabilidad y revision sin eliminar registros existentes", () => {
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS "cargadoPorId" INTEGER NULL/i);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS revisada BOOLEAN NOT NULL DEFAULT FALSE/i);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS "revisadaAt" TIMESTAMPTZ NULL/i);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS "revisadaPorId" INTEGER NULL/i);
    expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS facturas_revisada_idx/i);
    expect(sql).not.toMatch(/\bDELETE\b|DROP\s+TABLE|TRUNCATE/i);
  });
});
