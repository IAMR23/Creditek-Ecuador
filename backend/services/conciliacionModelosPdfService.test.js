jest.mock("../models/ConciliacionModeloTv", () => ({
  findOne: jest.fn(),
  create: jest.fn(),
}));

jest.mock("../models/ConciliacionModeloCelular", () => ({
  findOne: jest.fn(),
  create: jest.fn(),
}));

jest.mock("../config/db", () => ({
  sequelize: {
    transaction: jest.fn(async (callback) => callback({ id: "tx-modelos" })),
  },
}));

const ConciliacionModeloTv = require("../models/ConciliacionModeloTv");
const ConciliacionModeloCelular = require("../models/ConciliacionModeloCelular");
const {
  extraerModelosDesdeResultado,
  extraerModelosDesdeVentas,
  sincronizarModelosDesdeVentas,
} = require("./conciliacionModelosPdfService");

describe("conciliacionModelosPdfService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("agrupa los modelos ya extraidos del cierre de caja", () => {
    expect(
      extraerModelosDesdeVentas([
        { MODELO: "  Galaxy Á15  ", ARCHIVO: "uphone-1.pdf" },
        { MODELO: "Galaxy A15", ARCHIVO: "uphone-2.pdf" },
        { MODELO: "", ARCHIVO: "vacio.pdf" },
      ]),
    ).toEqual([
      {
        codigoPdf: "Galaxy Á15",
        codigoNormalizado: "GALAXY A15",
        vecesDetectado: 2,
        archivosOrigen: ["uphone-1.pdf", "uphone-2.pdf"],
      },
    ]);
  });

  test("conserva compatibilidad con el resultado del procesador de conciliacion", () => {
    expect(
      extraerModelosDesdeResultado({
        registros_validos: [
          { codigo_pdf: "TV 55", archivo_origen: "creditv.pdf" },
        ],
        errores: [
          { codigo_pdf: "TV 55", archivo_origen: "creditv.pdf" },
        ],
      }),
    ).toEqual([
      expect.objectContaining({
        codigoNormalizado: "TV 55",
        vecesDetectado: 2,
        archivosOrigen: ["creditv.pdf"],
      }),
    ]);
  });

  test("registra TV nuevos y actualiza celulares existentes sin perder su mapeo", async () => {
    const celularExistente = {
      codigoPdf: "IPHONE 15",
      vecesDetectado: 3,
      archivosOrigen: ["anterior.pdf"],
      estado: "MAPEADO",
      update: jest.fn().mockResolvedValue(undefined),
    };
    ConciliacionModeloTv.findOne.mockResolvedValue(null);
    ConciliacionModeloCelular.findOne.mockResolvedValue(celularExistente);

    const resultado = await sincronizarModelosDesdeVentas({
      ventasTv: [{ MODELO: "SMART TV 50", ARCHIVO: "creditv.pdf" }],
      ventasCelular: [{ MODELO: "IPHONE 15", ARCHIVO: "uphone.pdf" }],
    });

    expect(ConciliacionModeloTv.create).toHaveBeenCalledWith(
      expect.objectContaining({
        origen: "PDF_CREDITV",
        codigoNormalizado: "SMART TV 50",
        estado: "PENDIENTE",
      }),
      { transaction: { id: "tx-modelos" } },
    );
    expect(celularExistente.update).toHaveBeenCalledWith(
      {
        codigoPdf: "IPHONE 15",
        vecesDetectado: 4,
        archivosOrigen: ["anterior.pdf", "uphone.pdf"],
      },
      { transaction: { id: "tx-modelos" } },
    );
    expect(resultado).toEqual({
      tv: { detectados: 1, nuevos: 1, actualizados: 0 },
      celular: { detectados: 1, nuevos: 0, actualizados: 1 },
    });
  });
});
