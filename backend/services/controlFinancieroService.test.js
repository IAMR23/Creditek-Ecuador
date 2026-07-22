jest.mock("../config/db", () => ({
  sequelize: {
    query: jest.fn(),
    transaction: jest.fn(),
  },
}));

jest.mock("../models/ControlFinancieroCarga", () => ({
  create: jest.fn(),
  findOne: jest.fn(),
}));

jest.mock("../models/ControlFinancieroRegistro", () => ({
  bulkCreate: jest.fn(),
  findAll: jest.fn(),
}));

const { sequelize } = require("../config/db");
const ControlFinancieroCarga = require("../models/ControlFinancieroCarga");
const ControlFinancieroRegistro = require("../models/ControlFinancieroRegistro");
const {
  extraerFechaIso,
  guardarCargaControlFinanciero,
  obtenerFechaReporte,
} = require("./controlFinancieroService");

describe("controlFinancieroService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sequelize.transaction.mockImplementation(async (callback) =>
      callback({ id: "transaction", LOCK: { UPDATE: "UPDATE" } }),
    );
    sequelize.query.mockResolvedValue([]);
    ControlFinancieroCarga.findOne.mockResolvedValue(null);
    ControlFinancieroCarga.create.mockImplementation(async (payload) => ({
      id: 19,
      ...payload,
    }));
    ControlFinancieroRegistro.findAll.mockResolvedValue([]);
    ControlFinancieroRegistro.bulkCreate.mockResolvedValue([]);
  });

  test("guarda la carga y normaliza los tres tipos de registros", async () => {
    const carga = await guardarCargaControlFinanciero({
      usuarioId: 7,
      archivoGenerado: "CIERRE_CAJA.xlsx",
      datos: {
        registrosCaja: [
          {
            CONTRATO: 100,
            FECHA: "22/07/26 10:00 AM",
            VENDEDOR: "VENDEDOR",
            "USUARIO COBRADOR": "COBRADOR",
            CLIENTE: "CLIENTE CAJA",
            "PAGOS CUOTAS": 25.5,
            "Nro CUOTAS": "1 DE 12",
            PRODUCTO: "UPHONE",
            AGENCIA: "CAUPICHO",
            ARCHIVO: "caja.pdf",
            ARCHIVO_HASH: "a".repeat(64),
          },
        ],
        ventasTv: [
          {
            CONTRATO: "200",
            FECHA: "7/22/26 11:00 AM",
            VENDEDOR: "VENDEDOR TV",
            CLIENTE: "CLIENTE TV",
            MODELO: "TV 32",
            VENTAS: 300,
            ENTRADAS: 30,
            ARCHIVO: "tv.pdf",
            ARCHIVO_HASH: "b".repeat(64),
          },
        ],
        ventasCelular: [
          {
            CONTRATO: "300",
            FECHA: "7/22/26 12:00 PM",
            VENDEDOR: "VENDEDOR CELULAR",
            CLIENTE: "CLIENTE CELULAR",
            MODELO: "CELULAR X",
            IMEI: "123456789012345",
            VENTAS: 250,
            ENTRADAS: 20,
            ARCHIVO: "celular.pdf",
            ARCHIVO_HASH: "c".repeat(64),
          },
        ],
      },
    });

    expect(carga).toEqual(
      expect.objectContaining({
        carga: expect.objectContaining({ id: 19 }),
        esCargaNueva: true,
        archivosAgregados: 3,
        archivosOmitidos: 0,
        registrosAgregados: 3,
      }),
    );
    expect(ControlFinancieroCarga.create).toHaveBeenCalledWith(
      expect.objectContaining({
        fechaReporte: "2026-07-22",
        registrosCaja: 1,
        registrosVentasTv: 1,
        registrosVentasCelular: 1,
        totalPagosCaja: 25.5,
        totalVentasTv: 300,
        totalEntradasTv: 30,
        totalVentasCelular: 250,
        totalEntradasCelular: 20,
        usuarioId: 7,
      }),
      expect.objectContaining({
        transaction: expect.objectContaining({ id: "transaction" }),
      }),
    );

    const registros = ControlFinancieroRegistro.bulkCreate.mock.calls[0][0];
    expect(registros).toHaveLength(3);
    expect(registros.map((item) => item.tipoRegistro)).toEqual([
      "CAJA",
      "VENTA_TV",
      "VENTA_CELULAR",
    ]);
    expect(registros[2]).toEqual(
      expect.objectContaining({
        cargaId: 19,
        archivoHash: "c".repeat(64),
        imei: "123456789012345",
        producto: "UPHONE",
      }),
    );
  });

  test("rechaza cargas sin registros de caja", async () => {
    await expect(
      guardarCargaControlFinanciero({
        usuarioId: 7,
        archivoGenerado: "CIERRE_CAJA.xlsx",
        datos: { registrosCaja: [], ventasTv: [], ventasCelular: [] },
      }),
    ).rejects.toThrow("No existen registros de caja");

    expect(ControlFinancieroCarga.create).not.toHaveBeenCalled();
  });

  test("agrega archivos nuevos a la carga del mismo dia y omite los repetidos", async () => {
    const cargaExistente = {
      id: 5,
      registrosCaja: 1,
      registrosVentasTv: 0,
      registrosVentasCelular: 0,
      totalPagosCaja: "10.00",
      totalVentasTv: "0.00",
      totalEntradasTv: "0.00",
      totalVentasCelular: "0.00",
      totalEntradasCelular: "0.00",
      update: jest.fn(),
    };
    ControlFinancieroCarga.findOne.mockResolvedValue(cargaExistente);
    ControlFinancieroRegistro.findAll.mockResolvedValue([
      {
        tipoRegistro: "CAJA",
        archivoOrigen: "caja-anterior.pdf",
        archivoHash: "a".repeat(64),
      },
    ]);

    const resultado = await guardarCargaControlFinanciero({
      usuarioId: 8,
      archivoGenerado: "CIERRE_CAJA_20260721.xlsx",
      datos: {
        registrosCaja: [
          {
            CONTRATO: 100,
            FECHA: "7/21/26 10:00 AM",
            "PAGOS CUOTAS": 10,
            PRODUCTO: "UPHONE",
            AGENCIA: "CAUPICHO",
            ARCHIVO: "caja-anterior-renombrada.pdf",
            ARCHIVO_HASH: "a".repeat(64),
          },
          {
            CONTRATO: 101,
            FECHA: "7/21/26 11:00 AM",
            "PAGOS CUOTAS": 15,
            PRODUCTO: "CREDITV",
            AGENCIA: "SANGOLQUI",
            ARCHIVO: "caja-nueva.pdf",
            ARCHIVO_HASH: "d".repeat(64),
          },
        ],
        ventasTv: [
          {
            CONTRATO: 200,
            FECHA: "7/21/26 12:00 PM",
            VENTAS: 300,
            ENTRADAS: 30,
            ARCHIVO: "tv-nueva.pdf",
            ARCHIVO_HASH: "e".repeat(64),
          },
        ],
        ventasCelular: [],
      },
    });

    expect(resultado).toEqual(
      expect.objectContaining({
        carga: cargaExistente,
        esCargaNueva: false,
        archivosAgregados: 2,
        archivosOmitidos: 1,
        registrosAgregados: 2,
      }),
    );
    expect(ControlFinancieroCarga.create).not.toHaveBeenCalled();
    expect(cargaExistente.update).toHaveBeenCalledWith(
      expect.objectContaining({
        registrosCaja: 2,
        registrosVentasTv: 1,
        totalPagosCaja: 25,
        totalVentasTv: 300,
        totalEntradasTv: 30,
      }),
      expect.objectContaining({ transaction: expect.any(Object) }),
    );
    const agregados = ControlFinancieroRegistro.bulkCreate.mock.calls[0][0];
    expect(agregados).toHaveLength(2);
    expect(agregados.map((item) => item.archivoHash)).toEqual([
      "d".repeat(64),
      "e".repeat(64),
    ]);
  });

  test("obtiene la fecha predominante del PDF en formatos mes/dia y dia/mes", () => {
    expect(extraerFechaIso("7/21/26 12:33 PM")).toBe("2026-07-21");
    expect(extraerFechaIso("22/07/26 10:00 AM")).toBe("2026-07-22");
    expect(
      obtenerFechaReporte([
        { FECHA: "7/21/26 10:00 AM" },
        { FECHA: "7/22/26 10:00 AM" },
        { FECHA: "7/21/26 11:00 AM" },
      ]),
    ).toBe("2026-07-21");
  });
});
