jest.mock("../../services/facturasService", () => ({
  crearFacturaDesdeFoto: jest.fn(),
}));

const facturasService = require("../../services/facturasService");
const controller = require("./facturasController");

describe("facturasController de repartidor", () => {
  test("envia el tipo de documento al servicio al cargar la foto", async () => {
    const factura = { id: 7, tipo: "Nota de Venta" };
    facturasService.crearFacturaDesdeFoto.mockResolvedValue(factura);
    const req = {
      body: { tipo: "Nota de Venta" },
      file: { originalname: "factura.webp" },
      user: { id: 9 },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    await controller.cargarFoto(req, res);

    expect(facturasService.crearFacturaDesdeFoto).toHaveBeenCalledWith({
      file: req.file,
      userId: 9,
      tipo: "Nota de Venta",
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, factura }));
  });
});
