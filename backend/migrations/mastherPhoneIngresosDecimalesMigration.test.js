const fs = require("fs");
const path = require("path");

describe("migracion de precision monetaria Masther Phone", () => {
  const sql = fs.readFileSync(
    path.join(__dirname, "202610080007-ampliar-decimales-ingresos-masther-phone.sql"),
    "utf8",
  );

  test("amplia los valores a seis decimales y recalcula la restriccion", () => {
    expect(sql).toContain('"precioUnitario" TYPE NUMERIC(16, 6)');
    expect(sql).toContain("subtotal TYPE NUMERIC(20, 6)");
    expect(sql).toContain('ROUND("precioUnitario" * cantidad, 6)');
    expect(sql).toContain("ROUND(subtotal * 0.15, 6)");
    expect(sql).toContain('UPDATE logistica_masther_phone_ingresos');
    expect(sql).toContain('WHERE "precioUnitario" IS NOT NULL');
  });

  test("no elimina movimientos", () => {
    expect(sql).not.toMatch(/\b(?:DROP TABLE|TRUNCATE|DELETE FROM)\b/i);
  });
});
