jest.mock("../../controllers/Logistica/mastherPhoneInventarioController", () => ({
  actualizarIngreso: jest.fn(),
  catalogos: jest.fn(),
  eliminarIngreso: jest.fn(),
  guardarConciliacion: jest.fn(),
  listarIngresos: jest.fn(),
  registrarIngreso: jest.fn(),
  reporte: jest.fn(),
}));

jest.mock("../../middleware/authMiddleware", () => ({
  authenticate: jest.fn((_req, _res, next) => next()),
  requirePermission: jest.fn(() => (_req, _res, next) => next()),
}));

const { requirePermission } = require("../../middleware/authMiddleware");

describe("rutas del inventario Masther Phone", () => {
  test("protege toda la seccion con Logistica o Administracion", () => {
    const router = require("./mastherPhoneInventarioRoutes");

    expect(requirePermission).toHaveBeenCalledWith(
      "Logistica",
      "Administracion",
    );
    expect(
      router.stack.some(
        (layer) =>
          layer.route?.path === "/ingresos/:ingresoId" &&
          layer.route.methods.delete,
      ),
    ).toBe(true);
  });
});
