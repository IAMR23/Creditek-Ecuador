const fs = require("fs");
const path = require("path");

describe("migracion de datos laborales de usuarios", () => {
  test("agrega jornada y afiliacion con valores historicos seguros", () => {
    const sql = fs.readFileSync(
      path.join(
        __dirname,
        "202610080002-add-datos-laborales-usuarios.sql",
      ),
      "utf8",
    );

    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "jornadaLaboral"');
    expect(sql).toContain("DEFAULT 'tiempo_completo'");
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "afiliadoIess"');
    expect(sql).toContain("DEFAULT TRUE");
    expect(sql).toContain("usuarios_jornada_laboral_check");
    expect(sql).toContain("'tiempo_completo', 'medio_tiempo'");
    expect(sql).not.toMatch(/DROP\s+(COLUMN|TABLE)/i);
  });
});
