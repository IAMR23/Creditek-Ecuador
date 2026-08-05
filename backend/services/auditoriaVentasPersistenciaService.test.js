jest.mock("../models/AuditoriaVentaPdf", () => ({
  create: jest.fn(),
  findByPk: jest.fn(),
  findOne: jest.fn(),
}));

const { Op } = require("sequelize");
const AuditoriaVentaPdf = require("../models/AuditoriaVentaPdf");
const {
  guardarAuditoriaVentasPdf,
  obtenerAuditoriaVentasPdfPrecargada,
} = require("./auditoriaVentasPersistenciaService");

const payloadBase = {
  tipo: "TV",
  fechaInicio: "2026-07-25",
  fechaFin: "2026-07-25",
  origen: "CAJA",
  registrosPdf: [{ factura: "TV-1" }],
  resultados: [{ observacionError: "OK" }],
  resumen: { erroresDetectados: 0 },
  errores: [],
  usuarioId: 7,
  controlFinancieroCargaId: 25,
};

describe("auditoriaVentasPersistenciaService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("crea la precarga cuando la carga financiera aun no tiene auditoria", async () => {
    AuditoriaVentaPdf.findOne.mockResolvedValue(null);
    AuditoriaVentaPdf.create.mockResolvedValue({ id: 60, ...payloadBase });

    const resultado = await guardarAuditoriaVentasPdf(payloadBase);

    expect(AuditoriaVentaPdf.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: "TV",
        controlFinancieroCargaId: 25,
        registrosPdf: [{ factura: "TV-1" }],
      }),
    );
    expect(resultado.id).toBe(60);
  });

  test("actualiza la misma precarga por carga y tipo sin duplicarla", async () => {
    const auditoriaExistente = {
      id: 60,
      update: jest.fn(),
      get: jest.fn(() => ({ id: 60, ...payloadBase })),
    };
    AuditoriaVentaPdf.findOne.mockResolvedValue(auditoriaExistente);

    await guardarAuditoriaVentasPdf({
      ...payloadBase,
      resultados: [{ observacionError: "PRECIO_DIFERENTE" }],
    });

    expect(auditoriaExistente.update).toHaveBeenCalledWith(
      expect.objectContaining({
        resultados: [{ observacionError: "PRECIO_DIFERENTE" }],
      }),
    );
    expect(AuditoriaVentaPdf.create).not.toHaveBeenCalled();
  });

  test("busca la precarga mas reciente que cruza el rango solicitado", async () => {
    AuditoriaVentaPdf.findOne.mockResolvedValue({ id: 61, tipo: "CELULAR" });

    await obtenerAuditoriaVentasPdfPrecargada({
      tipo: "celular",
      fechaInicio: "2026-07-20",
      fechaFin: "2026-07-25",
    });

    const consulta = AuditoriaVentaPdf.findOne.mock.calls[0][0];
    expect(consulta.where.tipo).toBe("CELULAR");
    expect(consulta.where.fechaInicio[Op.lte]).toBe("2026-07-25");
    expect(consulta.where.fechaFin[Op.gte]).toBe("2026-07-20");
    expect(consulta.order).toEqual([["updatedAt", "DESC"]]);
  });

  test("limita la precarga a la carga activa de Control financiero", async () => {
    AuditoriaVentaPdf.findOne.mockResolvedValue({ id: 62, tipo: "TV" });

    await obtenerAuditoriaVentasPdfPrecargada({
      tipo: "TV",
      fechaInicio: "2026-08-03",
      fechaFin: "2026-08-03",
      controlFinancieroCargaIds: [33],
    });

    const consulta = AuditoriaVentaPdf.findOne.mock.calls[0][0];
    expect(consulta.where.controlFinancieroCargaId[Op.in]).toEqual([33]);
  });
});
