const {
  auditarVentasDesdeRegistros,
  auditarVentasDesdeDirectorios,
} = require("./auditoriaVentasPdfService");

const crearResultado = ({ tipo, registros = 1, inconsistencias = 0 }) => ({
  ok: true,
  tipo,
  resumen: {
    registrosPdf: registros,
    erroresDetectados: inconsistencias,
  },
  ventas: [],
  errores: [],
});

const ejecutarEscenario = ({ pdfsTv = 0, pdfsCelular = 0, auditar }) => {
  const auditarDirectorio = auditar ||
    jest.fn(({ tipo }) =>
      Promise.resolve(crearResultado({ tipo })),
    );

  return {
    auditarDirectorio,
    promesa: auditarVentasDesdeDirectorios({
      directorioTv: "C:/temp/tv",
      directorioCelular: "C:/temp/celular",
      directorioResultados: "C:/temp/resultados",
      fechaInicio: "2026-07-25",
      fechaFin: "2026-07-25",
      usuarioId: 7,
      app: { get: jest.fn() },
      dependencias: { dependencia: true },
      contarPdfsDirectorio: jest.fn((directorio) =>
        Promise.resolve(directorio.endsWith("/tv") ? pdfsTv : pdfsCelular),
      ),
      auditarDirectorio,
    }),
  };
};

describe("auditarVentasDesdeDirectorios", () => {
  test("audita solamente TV cuando solo hay PDF de ventas TV", async () => {
    const { promesa, auditarDirectorio } = ejecutarEscenario({ pdfsTv: 1 });

    await expect(promesa).resolves.toMatchObject({
      estado: "COMPLETADA",
      tv: { aplica: true, registros: 1, inconsistencias: 0 },
      celular: { aplica: false, registros: 0, inconsistencias: 0 },
    });
    expect(auditarDirectorio).toHaveBeenCalledTimes(1);
    expect(auditarDirectorio).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: "TV",
        fechaInicio: "2026-07-25",
        fechaFin: "2026-07-25",
      }),
    );
  });

  test("audita solamente CELULAR cuando solo hay PDF de ventas celular", async () => {
    const { promesa, auditarDirectorio } = ejecutarEscenario({
      pdfsCelular: 1,
    });

    await expect(promesa).resolves.toMatchObject({
      estado: "COMPLETADA",
      tv: { aplica: false },
      celular: { aplica: true, registros: 1, inconsistencias: 0 },
    });
    expect(auditarDirectorio).toHaveBeenCalledTimes(1);
    expect(auditarDirectorio).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: "CELULAR" }),
    );
  });

  test("audita TV y CELULAR una sola vez y suma las inconsistencias", async () => {
    const auditarDirectorio = jest.fn(({ tipo }) =>
      Promise.resolve(
        crearResultado({
          tipo,
          registros: tipo === "TV" ? 3 : 2,
          inconsistencias: tipo === "TV" ? 1 : 2,
        }),
      ),
    );
    const { promesa } = ejecutarEscenario({
      pdfsTv: 1,
      pdfsCelular: 1,
      auditar: auditarDirectorio,
    });

    await expect(promesa).resolves.toMatchObject({
      estado: "COMPLETADA_CON_INCONSISTENCIAS",
      inconsistencias: 3,
      tv: { registros: 3, inconsistencias: 1 },
      celular: { registros: 2, inconsistencias: 2 },
    });
    expect(auditarDirectorio).toHaveBeenCalledTimes(2);
  });

  test("no aplica auditoria cuando solo se enviaron reportes de caja", async () => {
    const { promesa, auditarDirectorio } = ejecutarEscenario({});

    await expect(promesa).resolves.toMatchObject({
      estado: "NO_APLICA",
      inconsistencias: 0,
    });
    expect(auditarDirectorio).not.toHaveBeenCalled();
  });

  test("marca ERROR y continua con el otro tipo si falla un procesador", async () => {
    const auditarDirectorio = jest.fn(({ tipo }) => {
      if (tipo === "TV") return Promise.reject(new Error("Fallo Python TV"));
      return Promise.resolve(
        crearResultado({ tipo, registros: 2, inconsistencias: 0 }),
      );
    });
    const { promesa } = ejecutarEscenario({
      pdfsTv: 1,
      pdfsCelular: 1,
      auditar: auditarDirectorio,
    });

    await expect(promesa).resolves.toMatchObject({
      estado: "ERROR",
      celular: { registros: 2 },
      errores: [{ tipo: "TV", message: "Fallo Python TV" }],
    });
    expect(auditarDirectorio).toHaveBeenCalledTimes(2);
  });
});

describe("auditarVentasDesdeRegistros", () => {
  test("persiste registros extraidos y resultados para poder reauditarlos", async () => {
    const persistirAuditoriaVentasPdf = jest.fn();
    const registrosPdf = [{ factura: "TV-1", codigo_pdf: "ABC" }];
    const ventasAuditadas = [
      { detalleVentaId: 10, observacionError: "PRECIO_DIFERENTE" },
    ];

    const resultado = await auditarVentasDesdeRegistros({
      tipo: "TV",
      registrosPdf,
      totalRegistrosPdf: 1,
      pdfsProcesados: 1,
      fechaInicio: "2026-07-25",
      fechaFin: "2026-07-25",
      usuarioId: 7,
      origenAuditoria: "CAJA",
      controlFinancieroCargaId: 25,
      obtenerReporteAuditoria: jest.fn().mockResolvedValue([{ id: 1 }]),
      contarDispositivosCreditoRve: jest.fn().mockReturnValue(1),
      auditarRegistrosPdf: jest
        .fn()
        .mockResolvedValue({ resultados: ventasAuditadas }),
      esFilaConIncidencia: jest.fn().mockReturnValue(true),
      notificarDiferenciasPrecioAuditoria: jest.fn(),
      persistirAuditoriaVentasPdf,
    });

    expect(resultado.resumen.erroresDetectados).toBe(1);
    expect(persistirAuditoriaVentasPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: "TV",
        origen: "CAJA",
        estado: "COMPLETADA_CON_INCONSISTENCIAS",
        registrosPdf,
        resultados: ventasAuditadas,
        controlFinancieroCargaId: 25,
      }),
    );
  });
});
