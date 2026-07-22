jest.mock("../../models/ControlFinancieroCarga", () => ({
  findAndCountAll: jest.fn(),
  findByPk: jest.fn(),
}));

jest.mock("../../models/ControlFinancieroRegistro", () => ({
  findAll: jest.fn(),
}));

jest.mock("../../models/Usuario", () => ({}));

const ControlFinancieroCarga = require("../../models/ControlFinancieroCarga");
const ControlFinancieroRegistro = require("../../models/ControlFinancieroRegistro");
const controller = require("./controlFinancieroController");

const crearRes = () => {
  const res = {
    status: jest.fn(),
    json: jest.fn(),
  };
  res.status.mockReturnValue(res);
  return res;
};

describe("controlFinancieroController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("devuelve el detalle agrupado por caja, TV y celular", async () => {
    ControlFinancieroCarga.findByPk.mockResolvedValue({
      get: () => ({
        id: 5,
        archivoGenerado: "CIERRE.xlsx",
        totalPagosCaja: "10.50",
        totalVentasTv: "300.00",
        totalEntradasTv: "30.00",
        totalVentasCelular: "250.00",
        totalEntradasCelular: "20.00",
      }),
    });
    ControlFinancieroRegistro.findAll.mockResolvedValue(
      ["CAJA", "VENTA_TV", "VENTA_CELULAR"].map((tipoRegistro, index) => ({
        get: () => ({
          id: index + 1,
          tipoRegistro,
          pagosCuotas: tipoRegistro === "CAJA" ? "10.50" : "0.00",
          ventas: tipoRegistro === "CAJA" ? "0.00" : "100.00",
          entradas: tipoRegistro === "CAJA" ? "0.00" : "10.00",
        }),
      })),
    );
    const res = crearRes();

    await controller.obtenerCarga({ params: { id: "5" } }, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        carga: expect.objectContaining({ totalPagosCaja: 10.5 }),
        registros: expect.objectContaining({
          caja: [expect.objectContaining({ tipoRegistro: "CAJA" })],
          ventasTv: [expect.objectContaining({ tipoRegistro: "VENTA_TV" })],
          ventasCelular: [
            expect.objectContaining({ tipoRegistro: "VENTA_CELULAR" }),
          ],
        }),
      }),
    );
  });

  test("rechaza un identificador de carga invalido", async () => {
    const res = crearRes();

    await controller.obtenerCarga({ params: { id: "abc" } }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(ControlFinancieroCarga.findByPk).not.toHaveBeenCalled();
  });

  test("elimina una carga y sus registros asociados", async () => {
    const carga = { destroy: jest.fn().mockResolvedValue(undefined) };
    ControlFinancieroCarga.findByPk.mockResolvedValue(carga);
    const res = crearRes();

    await controller.eliminarCarga({ params: { id: "5" } }, res);

    expect(ControlFinancieroCarga.findByPk).toHaveBeenCalledWith(5);
    expect(carga.destroy).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      message: "La carga y sus registros fueron eliminados.",
      cargaId: 5,
    });
  });

  test("responde 404 al eliminar una carga inexistente", async () => {
    ControlFinancieroCarga.findByPk.mockResolvedValue(null);
    const res = crearRes();

    await controller.eliminarCarga({ params: { id: "99" } }, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});
