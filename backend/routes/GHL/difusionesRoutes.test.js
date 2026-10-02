const fs = require("fs");
const path = require("path");

describe("rutas de difusiones GHL", () => {
  const source = fs.readFileSync(path.join(__dirname, "difusionesRoutes.js"), "utf8");

  test("protege todo el modulo con JWT, permisos y rol administrador", () => {
    expect(source).toMatch(/router\.use\([\s\S]*authenticate,[\s\S]*requirePermission\("Sistemas", "Administracion"\),[\s\S]*requireAdminRole/);
  });

  test("separa consulta, vista previa y confirmacion de envio", () => {
    expect(source).toContain('router.get("/estado"');
    expect(source).toContain('router.get("/contactos"');
    expect(source).toContain('router.get("/etiquetas"');
    expect(source).toContain('router.get("/catalogos/pipelines"');
    expect(source).toContain('router.get("/mensajes"');
    expect(source).toContain('router.post("/mensajes"');
    expect(source).toContain('router.put("/mensajes/:id"');
    expect(source).toContain('router.delete("/mensajes/:id"');
    expect(source).toContain('router.post("/vista-previa"');
    expect(source).toContain('router.post("/enviar"');
    expect(source).toContain('router.get("/ejecuciones/activa"');
    expect(source).toContain('router.get("/ejecuciones", controller.executions)');
    expect(source).toContain('router.get("/ejecuciones/:id"');
    expect(source).toContain('router.post("/ejecuciones/:id/cancelar"');
  });

  test("restringe la administracion de listas inteligentes al rol admin", () => {
    expect(source).toContain("requireAdminRole");
    expect(source.indexOf("requireAdminRole")).toBeLessThan(source.indexOf('router.get("/listas"'));
  });
});
