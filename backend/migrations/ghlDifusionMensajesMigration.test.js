const fs = require("fs");
const path = require("path");

describe("migracion de mensajes guardados y variantes GHL", () => {
  const sql = fs.readFileSync(
    path.join(__dirname, "202609290001-create-ghl-difusion-mensajes-y-variantes.sql"),
    "utf8",
  );

  test("crea la biblioteca con auditoria e indices", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS ghl_difusion_mensajes");
    expect(sql).toContain('"creadoPorId" INTEGER NOT NULL REFERENCES usuarios(id)');
    expect(sql).toContain('"actualizadoPorId" INTEGER NOT NULL REFERENCES usuarios(id)');
    expect(sql).toContain("ghl_difusion_mensajes_nombre_unique");
  });

  test("agrega variantes de forma compatible y conserva datos", () => {
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS mensajes JSONB");
    expect(sql).toContain("SET mensajes = jsonb_build_array(mensaje)");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS mensaje TEXT");
    expect(sql).not.toMatch(/DROP\s+(TABLE|COLUMN)/i);
    expect(sql).not.toMatch(/DELETE\s+FROM/i);
  });
});
