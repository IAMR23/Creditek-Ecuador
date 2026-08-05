jest.mock("../models/ControlFinancieroCarga", () => ({
  findAll: jest.fn(),
}));

jest.mock("../models/ControlFinancieroRegistro", () => ({
  findAll: jest.fn(),
}));

const { Op } = require("sequelize");
const ControlFinancieroCarga = require("../models/ControlFinancieroCarga");
const ControlFinancieroRegistro = require("../models/ControlFinancieroRegistro");
const {
  obtenerRegistrosAuditoriaDesdeControlFinanciero,
} = require("./controlFinancieroAuditoriaService");

describe("controlFinancieroAuditoriaService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("carga solamente los reportes TV guardados para el dia seleccionado", async () => {
    ControlFinancieroCarga.findAll.mockResolvedValue([
      { id: 33, fechaReporte: "2026-08-03" },
    ]);
    ControlFinancieroRegistro.findAll.mockResolvedValue([
      {
        id: 101,
        cargaId: 33,
        contrato: "TV-DIA-3",
        fecha: "8/3/26 10:00 AM",
        cliente: "CLIENTE",
        modelo: "LA32ZEC",
        ventas: "120.00",
        entradas: "20.00",
        archivoOrigen: "tv-dia-3.pdf",
        archivoHash: "a".repeat(64),
      },
    ]);

    const resultado =
      await obtenerRegistrosAuditoriaDesdeControlFinanciero({
        tipo: "TV",
        fechaInicio: "2026-08-03",
        fechaFin: "2026-08-03",
      });

    const consultaCargas = ControlFinancieroCarga.findAll.mock.calls[0][0];
    expect(consultaCargas.where.fechaReporte[Op.between]).toEqual([
      "2026-08-03",
      "2026-08-03",
    ]);
    expect(ControlFinancieroRegistro.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tipoRegistro: "VENTA_TV" }),
      }),
    );
    expect(resultado).toMatchObject({
      cargaIds: [33],
      totalRegistrosPdf: 1,
      pdfsProcesados: 1,
      registrosPdf: [
        expect.objectContaining({
          factura: "TV-DIA-3",
          codigo_pdf: "LA32ZEC",
          valor_ventas: 120,
          entrada: 20,
        }),
      ],
    });
  });

  test("no mezcla reportes de otra fecha cuando el dia no tiene carga activa", async () => {
    ControlFinancieroCarga.findAll.mockResolvedValue([]);

    const resultado =
      await obtenerRegistrosAuditoriaDesdeControlFinanciero({
        tipo: "CELULAR",
        fechaInicio: "2026-08-04",
        fechaFin: "2026-08-04",
      });

    expect(resultado.cargaIds).toEqual([]);
    expect(resultado.registrosPdf).toEqual([]);
    expect(ControlFinancieroRegistro.findAll).not.toHaveBeenCalled();
  });
});
