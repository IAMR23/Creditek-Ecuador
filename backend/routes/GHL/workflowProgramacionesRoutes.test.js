const fs = require("fs");
const path = require("path");

describe("rutas administrativas de workflows GHL", () => {
  const source = fs.readFileSync(path.join(__dirname, "workflowProgramacionesRoutes.js"), "utf8");

  test("protege todo el router con JWT y permisos administrativos", () => {
    expect(source).toMatch(/router\.use\(authenticate, requirePermission\("Gerencia", "Administracion", "Sistemas"\)\)/);
  });

  test("expone catalogos, CRUD, vista previa e historial sin endpoint manual de inscripcion", () => {
    expect(source).toContain('/catalogos/pipelines');
    expect(source).toContain('/catalogos/workflows');
    expect(source).toContain('/programaciones');
    expect(source).toContain('/vista-previa');
    expect(source).toContain('/ejecuciones');
    expect(source).toContain('/programaciones/:id/ejecutar-ahora');
    expect(source).toContain('/scheduler/estado');
    expect(source).not.toMatch(/\/execute|\/inscribir/);
  });
});
