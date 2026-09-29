const fs = require("fs");
const path = require("path");

describe("migracion de usuario Uphone", () => {
  test("agrega la columna opcional a usuarios de forma idempotente", () => {
    const sql = fs.readFileSync(
      path.join(
        __dirname,
        "202609290003-add-usuario-uphone-to-usuarios.sql",
      ),
      "utf8",
    );

    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "usuarioUphone"');
    expect(sql).toContain("VARCHAR(100) NULL");
    expect(sql).toContain(
      "CREATE UNIQUE INDEX IF NOT EXISTS usuarios_usuario_uphone_lower_unique",
    );
    expect(sql).toContain('LOWER(BTRIM("usuarioUphone"))');
    expect(sql).not.toMatch(/DROP\s+(COLUMN|TABLE)/i);
  });
});
