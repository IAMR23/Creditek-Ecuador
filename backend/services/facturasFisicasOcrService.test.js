jest.mock("../models/FacturaFisica", () => ({
  findByPk: jest.fn(),
  update: jest.fn(),
}));

jest.mock("../config/db", () => ({
  sequelize: {
    transaction: jest.fn(async (callback) => callback({ id: "tx-test" })),
  },
}));

jest.mock("./facturasFisicasService", () => ({
  obtenerArchivoFactura: jest.fn(),
  obtenerFactura: jest.fn(),
}));

jest.mock("./facturasFisicasProductosOcrService", () => ({
  validarProductosProcesador: jest.fn((value) =>
    Array.isArray(value) ? value : [],
  ),
  persistirProductosDetectados: jest.fn(),
}));

const FacturaFisica = require("../models/FacturaFisica");
const facturasFisicasService = require("./facturasFisicasService");
const facturasFisicasProductosOcrService = require(
  "./facturasFisicasProductosOcrService",
);
const {
  aplicarSugerenciasOcr,
  procesarOcrFactura,
  validarResultadoOcr,
} = require("./facturasFisicasOcrService");

const crearFactura = (overrides = {}) => ({
  id: 7,
  estado: "CARGADA",
  mimeType: "image/jpeg",
  extension: "jpg",
  ocrEstado: "NO_PROCESADO",
  ocrHistorial: [],
  ocrCampos: null,
  update: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

const resultadoOcr = (overrides = {}) => ({
  ok: true,
  texto: "RUC 1790012345001 FACTURA 001-002-000012345 TOTAL 115.00",
  campos: {
    proveedor: "EMPRESA XYZ",
    rucProveedor: "1790012345001",
    numeroFactura: "001-002-000012345",
    fechaEmision: "2026-08-19",
    subtotal: 100,
    impuestos: 15,
    total: 115,
  },
  advertencias: [],
  productos: [],
  metadata: {
    motor: "tesseract",
    versionProcesador: "1.0.0",
    paginas: 1,
  },
  ...overrides,
});

describe("facturasFisicasOcrService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    facturasFisicasProductosOcrService.validarProductosProcesador.mockImplementation(
      (value) => (Array.isArray(value) ? value : []),
    );
    facturasFisicasProductosOcrService.persistirProductosDetectados.mockResolvedValue({
      creados: 0,
      preservados: 0,
      versionOcr: 1,
    });
  });

  test("valida y limita el resultado estructurado del procesador", () => {
    expect(validarResultadoOcr(resultadoOcr())).toEqual(
      expect.objectContaining({
        motor: "tesseract",
        version: "1.0.0",
        campos: expect.objectContaining({ total: 115 }),
      }),
    );
  });

  test("procesa OCR sin sobrescribir campos manuales", async () => {
    const factura = crearFactura({ proveedor: "PROVEEDOR MANUAL" });
    FacturaFisica.findByPk.mockResolvedValue(factura);
    FacturaFisica.update.mockResolvedValueOnce([1]).mockResolvedValueOnce([1]);
    facturasFisicasService.obtenerArchivoFactura.mockResolvedValue({
      rutaAbsoluta: "C:\\storage\\factura.jpg",
    });
    facturasFisicasService.obtenerFactura.mockResolvedValue({
      id: 7,
      proveedor: "PROVEEDOR MANUAL",
      ocrCampos: resultadoOcr().campos,
    });
    const ejecutarProcesador = jest.fn().mockResolvedValue(resultadoOcr());

    const result = await procesarOcrFactura({
      id: 7,
      usuarioId: 9,
      ejecutarProcesador,
    });

    expect(result.proveedor).toBe("PROVEEDOR MANUAL");
    expect(FacturaFisica.update.mock.calls[1][0]).not.toHaveProperty("proveedor");
    expect(FacturaFisica.update.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        ocrEstado: "PROCESADO",
        ocrTexto: expect.stringContaining("1790012345001"),
        ocrCampos: expect.objectContaining({ proveedor: "EMPRESA XYZ" }),
        ocrProcesadoPorId: 9,
      }),
    );
  });

  test("rechaza dos procesamientos simultaneos de la misma factura", async () => {
    FacturaFisica.findByPk.mockResolvedValue(crearFactura({ ocrEstado: "PROCESANDO" }));
    FacturaFisica.update.mockResolvedValueOnce([0]);
    facturasFisicasService.obtenerArchivoFactura.mockResolvedValue({
      rutaAbsoluta: "C:\\storage\\factura.jpg",
    });
    const ejecutarProcesador = jest.fn();

    await expect(
      procesarOcrFactura({ id: 7, usuarioId: 9, ejecutarProcesador }),
    ).rejects.toMatchObject({ statusCode: 409, codigo: "OCR_IN_PROGRESS" });
    expect(ejecutarProcesador).not.toHaveBeenCalled();
  });

  test("permite reprocesar y reemplaza solo el resultado OCR anterior", async () => {
    const factura = crearFactura({
      proveedor: "VALOR MANUAL",
      ocrEstado: "PROCESADO",
      ocrTexto: "texto anterior",
      ocrCampos: { proveedor: "ANTERIOR" },
      ocrHistorial: [{ tipo: "PROCESAMIENTO_FINALIZADO" }],
    });
    FacturaFisica.findByPk.mockResolvedValue(factura);
    FacturaFisica.update.mockResolvedValueOnce([1]).mockResolvedValueOnce([1]);
    facturasFisicasService.obtenerArchivoFactura.mockResolvedValue({
      rutaAbsoluta: "C:\\storage\\factura.jpg",
    });
    facturasFisicasService.obtenerFactura.mockResolvedValue({
      id: 7,
      proveedor: "VALOR MANUAL",
      ocrTexto: resultadoOcr().texto,
    });

    await procesarOcrFactura({
      id: 7,
      usuarioId: 9,
      ejecutarProcesador: jest.fn().mockResolvedValue(resultadoOcr()),
    });

    const finalUpdate = FacturaFisica.update.mock.calls[1][0];
    expect(finalUpdate.ocrTexto).toBe(resultadoOcr().texto);
    expect(finalUpdate.ocrHistorial).toHaveLength(3);
    expect(finalUpdate).not.toHaveProperty("proveedor");
  });

  test("persiste productos dentro de la transaccion y advierte los preservados", async () => {
    const factura = crearFactura({ ocrEstado: "PROCESADO" });
    const productos = [
      {
        descripcion: "Monitor 24 pulgadas",
        cantidad: 2,
        precioUnitario: 100,
        descuento: 0,
        totalLinea: 200,
        codigo: "MON-24",
        advertencias: [],
        orden: 1,
      },
    ];
    FacturaFisica.findByPk.mockResolvedValue(factura);
    FacturaFisica.update.mockResolvedValueOnce([1]).mockResolvedValueOnce([1]);
    facturasFisicasService.obtenerArchivoFactura.mockResolvedValue({
      rutaAbsoluta: "C:\\storage\\factura.jpg",
    });
    facturasFisicasService.obtenerFactura.mockResolvedValue({ id: 7 });
    facturasFisicasProductosOcrService.persistirProductosDetectados.mockResolvedValue({
      creados: 1,
      preservados: 2,
      versionOcr: 3,
    });

    await procesarOcrFactura({
      id: 7,
      usuarioId: 9,
      ejecutarProcesador: jest.fn().mockResolvedValue(
        resultadoOcr({ productos }),
      ),
    });

    expect(
      facturasFisicasProductosOcrService.persistirProductosDetectados,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        facturaId: 7,
        productos,
        usuarioId: 9,
        transaction: { id: "tx-test" },
      }),
    );
    expect(FacturaFisica.update.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        ocrEstado: "PROCESADO_CON_ADVERTENCIAS",
        ocrAdvertencias: expect.arrayContaining([
          expect.stringContaining("Se preservaron 2 producto(s)"),
        ]),
        ocrMetadata: expect.objectContaining({
          productosPersistencia: {
            creados: 1,
            preservados: 2,
            versionOcr: 3,
          },
        }),
      }),
    );
  });

  test("no procesa una factura anulada", async () => {
    FacturaFisica.findByPk.mockResolvedValue(crearFactura({ estado: "ANULADA" }));
    await expect(
      procesarOcrFactura({ id: 7, usuarioId: 9, ejecutarProcesador: jest.fn() }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(facturasFisicasService.obtenerArchivoFactura).not.toHaveBeenCalled();
  });

  test("un error OCR deja estado y trazabilidad sin eliminar la factura", async () => {
    FacturaFisica.findByPk.mockResolvedValue(crearFactura());
    FacturaFisica.update.mockResolvedValueOnce([1]).mockResolvedValueOnce([1]);
    facturasFisicasService.obtenerArchivoFactura.mockResolvedValue({
      rutaAbsoluta: "C:\\storage\\factura.jpg",
    });
    const error = Object.assign(new Error("OCR no disponible"), { statusCode: 502 });

    await expect(
      procesarOcrFactura({
        id: 7,
        usuarioId: 9,
        ejecutarProcesador: jest.fn().mockRejectedValue(error),
      }),
    ).rejects.toThrow("OCR no disponible");
    expect(FacturaFisica.update.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        ocrEstado: "ERROR",
        ocrError: "OCR no disponible",
        ocrProcesamientoToken: null,
      }),
    );
  });

  test("aplica solo las sugerencias seleccionadas", async () => {
    const factura = crearFactura({
      proveedor: "MANUAL",
      total: 90,
      ocrEstado: "PROCESADO",
      ocrCampos: resultadoOcr().campos,
    });
    FacturaFisica.findByPk.mockResolvedValue(factura);
    facturasFisicasService.obtenerFactura.mockResolvedValue({
      id: 7,
      proveedor: "MANUAL",
      total: 115,
    });

    const result = await aplicarSugerenciasOcr({
      id: 7,
      usuarioId: 9,
      campos: ["total"],
    });

    expect(factura.update).toHaveBeenCalledWith(
      expect.objectContaining({ total: 115, actualizadoPorId: 9 }),
    );
    expect(factura.update.mock.calls[0][0]).not.toHaveProperty("proveedor");
    expect(result.camposAplicados).toEqual(["total"]);
  });

  test("aplica varias sugerencias solicitadas y conserva las no seleccionadas", async () => {
    const factura = crearFactura({
      proveedor: "MANUAL",
      numeroFactura: "MANUAL-1",
      ocrEstado: "PROCESADO_CON_ADVERTENCIAS",
      ocrCampos: resultadoOcr().campos,
    });
    FacturaFisica.findByPk.mockResolvedValue(factura);
    facturasFisicasService.obtenerFactura.mockResolvedValue({ id: 7 });

    const result = await aplicarSugerenciasOcr({
      id: 7,
      usuarioId: 9,
      campos: ["proveedor", "fechaEmision", "subtotal"],
    });

    expect(factura.update).toHaveBeenCalledWith(
      expect.objectContaining({
        proveedor: "EMPRESA XYZ",
        fechaEmision: "2026-08-19",
        subtotal: 100,
      }),
    );
    expect(factura.update.mock.calls[0][0]).not.toHaveProperty("numeroFactura");
    expect(result.camposAplicados).toEqual([
      "proveedor",
      "fechaEmision",
      "subtotal",
    ]);
  });
});
