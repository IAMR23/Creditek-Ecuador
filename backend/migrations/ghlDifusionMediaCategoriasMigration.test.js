const fs = require("fs");
const path = require("path");

describe("migracion de categorias e imagenes de difusiones", () => {
  const sql = fs.readFileSync(
    path.join(__dirname, "202610210001-add-ghl-difusion-media-categorias.sql"),
    "utf8",
  );

  test("crea categorias sin eliminar mensajes existentes", () => {
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS ghl_difusion_categorias");
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "categoriaId"');
    expect(sql).toContain("ON DELETE SET NULL");
    expect(sql).not.toMatch(/DROP TABLE|TRUNCATE/i);
  });

  test("persiste imagenes en biblioteca, ejecucion y detalle", () => {
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "imagenUrl" TEXT');
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS imagenes JSONB");
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS "imagenNombre"');
  });
});
