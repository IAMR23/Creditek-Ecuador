jest.mock("../models/AuditoriaVentaPdf", () => ({
  create: jest.fn(),
  findByPk: jest.fn(),
  findOne: jest.fn(),
  sequelize: {
    transaction: jest.fn(),
  },
}));

const { Op } = require("sequelize");
const AuditoriaVentaPdf = require("../models/AuditoriaVentaPdf");
const {
  actualizarComentarioResultadoAuditoriaVentasPdf,
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
    AuditoriaVentaPdf.sequelize.transaction.mockImplementation(async (callback) =>
      callback({ LOCK: { UPDATE: "UPDATE" } }),
    );
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

  test("guarda el comentario en una fila de auditoria sin venta", async () => {
    const update = jest.fn().mockResolvedValue(undefined);
    AuditoriaVentaPdf.findByPk.mockResolvedValue({
      id: 60,
      resultados: [
        { id: 10, comentarioAuditoria: "" },
        { id: null, observacionError: "VENTA_NO_ENCONTRADA" },
      ],
      update,
    });

    const resultado = await actualizarComentarioResultadoAuditoriaVentasPdf({
      auditoriaId: 60,
      resultadoIndex: 1,
      comentarioAuditoria: "Validar manualmente",
    });

    expect(update).toHaveBeenCalledWith(
      {
        resultados: [
          { id: 10, comentarioAuditoria: "" },
          {
            id: null,
            observacionError: "VENTA_NO_ENCONTRADA",
            comentarioAuditoria: "Validar manualmente",
          },
        ],
      },
      expect.objectContaining({ transaction: expect.any(Object) }),
    );
    expect(resultado.comentarioAuditoria).toBe("Validar manualmente");
  });

  test("conserva comentarios de errores al reauditar la misma precarga", async () => {
    const auditoriaExistente = {
      id: 60,
      resultados: [
        {
          id: null,
          tipo: "TV",
          contrato: "FAC-10",
          referenciaPdf: "TV32",
          fechaPdf: "2026-07-25",
          clientePdf: "CLIENTE UNO",
          comentarioAuditoria: "Pendiente de confirmar",
        },
      ],
      update: jest.fn(),
      get: jest.fn(() => ({ id: 60, ...payloadBase })),
    };
    AuditoriaVentaPdf.findOne.mockResolvedValue(auditoriaExistente);

    await guardarAuditoriaVentasPdf({
      ...payloadBase,
      resultados: [
        {
          id: null,
          tipo: "tv",
          contrato: "FAC-10",
          referenciaPdf: "tv32",
          fechaPdf: "2026-07-25",
          clientePdf: "Cliente Uno",
          observacionError: "VENTA_NO_ENCONTRADA",
          comentarioAuditoria: "",
        },
      ],
    });

    expect(auditoriaExistente.update).toHaveBeenCalledWith(
      expect.objectContaining({
        resultados: [
          expect.objectContaining({
            observacionError: "VENTA_NO_ENCONTRADA",
            comentarioAuditoria: "Pendiente de confirmar",
          }),
        ],
      }),
    );
  });
});
