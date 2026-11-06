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
    expect(sql).toContain("'tiempo_completo', 'tres_cuartos_tiempo', 'medio_tiempo'");
    expect(sql).not.toMatch(/DROP\s+(COLUMN|TABLE)/i);
  });

  test("amplia la restriccion existente sin modificar datos historicos", () => {
    const sql = fs.readFileSync(
      path.join(
        __dirname,
        "202611060001-allow-tres-cuartos-jornada-usuarios.sql",
      ),
      "utf8",
    );

    expect(sql).toContain("tres_cuartos_tiempo");
    expect(sql).toContain("VALIDATE CONSTRAINT usuarios_jornada_laboral_check");
    expect(sql).not.toMatch(/DROP\s+(COLUMN|TABLE)/i);
    expect(sql).not.toMatch(/UPDATE\s+public\.usuarios/i);
  });

  test("agrega el indicador de nomina conservando incluidos a los usuarios actuales", () => {
    const sql = fs.readFileSync(
      path.join(
        __dirname,
        "202611060002-add-activo-nomina-usuarios.sql",
      ),
      "utf8",
    );

    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "activoNomina" BOOLEAN');
    expect(sql).toContain('SET "activoNomina" = TRUE');
    expect(sql).toContain('ALTER COLUMN "activoNomina" SET NOT NULL');
    expect(sql).not.toMatch(/DROP\s+(COLUMN|TABLE)/i);
  });
});
