jest.mock("../../services/facturasService", () => ({
  eliminarFactura: jest.fn(),
  guardarFotoFactura: jest.fn(),
}));

const facturasService = require("../../services/facturasService");
const controller = require("./facturasController");

describe("facturasController de Gerencia", () => {
  test("envia el tipo de documento al servicio al guardar una foto", async () => {
    const factura = { id: 7, tipo: "Factura" };
    facturasService.guardarFotoFactura.mockResolvedValue(factura);
    const req = {
      body: { tipo: "Factura" },
      file: { originalname: "factura.webp" },
      params: { id: "7" },
      user: { id: 3 },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    await controller.cargarFoto(req, res);

    expect(facturasService.guardarFotoFactura).toHaveBeenCalledWith({
      id: "7",
      file: req.file,
      userId: 3,
      tipo: "Factura",
    });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true, factura }));
  });

  test("elimina definitivamente una factura por su id", async () => {
    facturasService.eliminarFactura.mockResolvedValue({ id: 7 });
    const req = { params: { id: "7" } };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    await controller.eliminar(req, res);

    expect(facturasService.eliminarFactura).toHaveBeenCalledWith({ id: "7" });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ok: true }));
  });
});
