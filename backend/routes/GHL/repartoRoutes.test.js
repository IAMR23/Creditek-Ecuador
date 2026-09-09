const { authenticate, requirePermission } = require("../../middleware/authMiddleware");
const router = require("./repartoRoutes");

describe("seguridad de endpoints de reparto GHL", () => {
  test("authenticate rechaza peticiones sin JWT", async () => {
    const req = { headers: {} };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    await authenticate(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: "TOKEN_MISSING" }));
  });

  test("requirePermission rechaza usuario sin permiso", () => {
    const req = { user: { permisos: ["Marketing"] } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    requirePermission("Gerencia", "Administracion", "Sistemas")(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test("expone disponibilidad propia y controles administrativos protegidos", () => {
    const paths = router.stack.filter((layer) => layer.route).map((layer) => `${Object.keys(layer.route.methods)[0].toUpperCase()} ${layer.route.path}`);
    expect(paths).toEqual(expect.arrayContaining([
      "GET /mi-disponibilidad",
      "PATCH /mi-disponibilidad",
      "GET /asesores",
      "PUT /asesores/:usuarioId/asociacion",
      "PATCH /asesores/:usuarioId/disponibilidad",
      "POST /ejecuciones/:id/pause",
      "POST /ejecuciones/:id/resume",
      "POST /ejecuciones/:id/cancel",
      "POST /ejecuciones/:id/force-finish-stale",
    ]));
    expect(router.stack.filter((layer) => !layer.route)).toHaveLength(2);
  });

  test("las rutas propias estan antes del permiso administrativo", () => {
    const selfIndex = router.stack.findIndex((layer) => layer.route?.path === "/mi-disponibilidad");
    const adminIndex = router.stack.findIndex((layer) => layer.route?.path === "/asesores");
    const middlewareIndexes = router.stack
      .map((layer, index) => (!layer.route ? index : -1))
      .filter((index) => index >= 0);

    expect(selfIndex).toBeGreaterThan(middlewareIndexes[0]);
    expect(selfIndex).toBeLessThan(middlewareIndexes[1]);
    expect(adminIndex).toBeGreaterThan(middlewareIndexes[1]);
  });
});
