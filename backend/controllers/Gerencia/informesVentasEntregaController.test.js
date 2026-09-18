jest.mock("../../services/ventaEntregaRelacionService", () => ({
  obtenerDashboardVentasConEntrega: jest.fn(),
  obtenerInformeVentasConEntrega: jest.fn(),
  obtenerPaginaInformeVentasConEntrega: jest.fn(),
}));

const {
  obtenerDashboardVentasConEntrega,
  obtenerInformeVentasConEntrega,
  obtenerPaginaInformeVentasConEntrega,
} = require("../../services/ventaEntregaRelacionService");
const { obtenerVentasConEntrega } = require("./informesController");

const crearRespuesta = () => {
  const res = {
    status: jest.fn(),
    json: jest.fn(),
  };
  res.status.mockReturnValue(res);
  return res;
};

describe("controlador del informe de ventas con entrega", () => {
  beforeEach(() => jest.clearAllMocks());

  test("devuelve listado paginado sin ejecutar el dashboard", async () => {
    obtenerPaginaInformeVentasConEntrega.mockResolvedValue({
      ventas: [{ ventaId: 1 }],
      page: 2,
      limit: 25,
      total: 30,
      totalPages: 2,
      resumen: { directas: 1, porCedula: 20, ambiguas: 9 },
    });
    const req = { query: { seccion: "listado", page: "2", limit: "25" } };
    const res = crearRespuesta();

    await obtenerVentasConEntrega(req, res);

    expect(obtenerPaginaInformeVentasConEntrega).toHaveBeenCalledWith(req.query);
    expect(obtenerDashboardVentasConEntrega).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ ok: true, total: 30, totalVentas: 30 }),
    );
  });

  test("permite cargar el dashboard de forma independiente", async () => {
    const dashboard = { entregasPorMes: [], ventasDesdeHoraPorMes: [] };
    obtenerDashboardVentasConEntrega.mockResolvedValue(dashboard);
    const req = { query: { seccion: "dashboard" } };
    const res = crearRespuesta();

    await obtenerVentasConEntrega(req, res);

    expect(obtenerDashboardVentasConEntrega).toHaveBeenCalledWith(req.query);
    expect(obtenerPaginaInformeVentasConEntrega).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ ok: true, dashboard });
  });

  test("la exportacion consulta todos los registros", async () => {
    obtenerInformeVentasConEntrega.mockResolvedValue([
      { ventaId: 1 },
      { ventaId: 2 },
    ]);
    const req = { query: { seccion: "listado", exportar: "true" } };
    const res = crearRespuesta();

    await obtenerVentasConEntrega(req, res);

    expect(obtenerInformeVentasConEntrega).toHaveBeenCalledWith(req.query);
    expect(obtenerPaginaInformeVentasConEntrega).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ total: 2, totalVentas: 2, totalPages: 1 }),
    );
  });
});
