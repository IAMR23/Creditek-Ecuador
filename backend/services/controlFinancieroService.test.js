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
  construirCoberturaReportes,
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

  test("guarda una carga que contiene solamente ventas TV", async () => {
    const resultado = await guardarCargaControlFinanciero({
      usuarioId: 7,
      archivoGenerado: "CIERRE_CAJA_20260723.xlsx",
      datos: {
        registrosCaja: [],
        ventasTv: [
          {
            CONTRATO: "TV-200",
            FECHA: "7/23/26 11:00 AM",
            VENDEDOR: "VENDEDOR TV",
            CLIENTE: "CLIENTE TV",
            MODELO: "TV 43",
            VENTAS: 450,
            ENTRADAS: 45,
            ARCHIVO: "tv.pdf",
            ARCHIVO_HASH: "d".repeat(64),
          },
        ],
        ventasCelular: [],
      },
    });

    expect(resultado.registrosAgregados).toBe(1);
    expect(ControlFinancieroCarga.create).toHaveBeenCalledWith(
      expect.objectContaining({
        fechaReporte: "2026-07-23",
        registrosCaja: 0,
        registrosVentasTv: 1,
        registrosVentasCelular: 0,
        totalPagosCaja: 0,
        totalVentasTv: 450,
        totalEntradasTv: 45,
      }),
      expect.any(Object),
    );
    expect(ControlFinancieroRegistro.bulkCreate.mock.calls[0][0][0]).toEqual(
      expect.objectContaining({ tipoRegistro: "VENTA_TV", cargaId: 19 }),
    );
  });

  test("guarda una carga que contiene solamente ventas celular", async () => {
    const resultado = await guardarCargaControlFinanciero({
      usuarioId: 7,
      archivoGenerado: "CIERRE_CAJA_20260724.xlsx",
      datos: {
        registrosCaja: [],
        ventasTv: [],
        ventasCelular: [
          {
            CONTRATO: "CEL-300",
            FECHA: "7/24/26 12:00 PM",
            VENDEDOR: "VENDEDOR CELULAR",
            CLIENTE: "CLIENTE CELULAR",
            MODELO: "CELULAR X",
            IMEI: "123456789012345",
            VENTAS: 300,
            ENTRADAS: 30,
            ARCHIVO: "celular.pdf",
            ARCHIVO_HASH: "e".repeat(64),
          },
        ],
      },
    });

    expect(resultado.registrosAgregados).toBe(1);
    expect(ControlFinancieroCarga.create).toHaveBeenCalledWith(
      expect.objectContaining({
        fechaReporte: "2026-07-24",
        registrosCaja: 0,
        registrosVentasTv: 0,
        registrosVentasCelular: 1,
        totalVentasCelular: 300,
        totalEntradasCelular: 30,
      }),
      expect.any(Object),
    );
    expect(ControlFinancieroRegistro.bulkCreate.mock.calls[0][0][0]).toEqual(
      expect.objectContaining({
        tipoRegistro: "VENTA_CELULAR",
        cargaId: 19,
        imei: "123456789012345",
      }),
    );
  });

  test("rechaza una carga sin registros validos de ningun tipo", async () => {
    await expect(
      guardarCargaControlFinanciero({
        usuarioId: 7,
        archivoGenerado: "CIERRE_CAJA.xlsx",
        datos: { registrosCaja: [], ventasTv: [], ventasCelular: [] },
      }),
    ).rejects.toThrow("No existen registros validos");

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
    expect(ControlFinancieroCarga.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { fechaReporte: "2026-07-21", estado: "ACTIVA" },
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

  test("omite registros repetidos aunque vengan de archivos distintos", async () => {
    const cargaExistente = {
      id: 6,
      registrosCaja: 0,
      registrosVentasTv: 1,
      registrosVentasCelular: 0,
      totalPagosCaja: "0.00",
      totalVentasTv: "350.00",
      totalEntradasTv: "0.00",
      totalVentasCelular: "0.00",
      totalEntradasCelular: "0.00",
      update: jest.fn(),
    };
    ControlFinancieroCarga.findOne.mockResolvedValue(cargaExistente);
    ControlFinancieroRegistro.findAll.mockResolvedValue([
      {
        tipoRegistro: "VENTA_TV",
        contrato: "367819",
        fecha: "8/6/26 7:56 PM",
        vendedor: "ARI2026",
        usuarioCobrador: null,
        cliente: "JUNIOR XAVIER COROZO ESTUPI\u00d1AN",
        modelo: "QLEDTV 50",
        imei: null,
        pagosCuotas: "0.00",
        numeroCuotas: null,
        ventas: "350.00",
        entradas: "0.00",
        producto: "CREDITV",
        agencia: null,
        archivoOrigen: "ventas-tv-anterior.pdf",
        archivoHash: "f".repeat(64),
      },
    ]);

    const resultado = await guardarCargaControlFinanciero({
      usuarioId: 8,
      archivoGenerado: "CIERRE_CAJA_20260806.xlsx",
      datos: {
        registrosCaja: [],
        ventasTv: [
          {
            CONTRATO: "367819",
            FECHA: "8/6/26 7:56 PM",
            VENDEDOR: "ari2026",
            CLIENTE: "JUNIOR XAVIER COROZO ESTUPINAN",
            MODELO: "QLEDTV 50",
            VENTAS: 350,
            ENTRADAS: 0,
            ARCHIVO: "ventas-tv-repetido.pdf",
            ARCHIVO_HASH: "1".repeat(64),
          },
          {
            CONTRATO: "367820",
            FECHA: "8/6/26 8:10 PM",
            VENDEDOR: "ARI2026",
            CLIENTE: "CLIENTE NUEVO",
            MODELO: "QLEDTV 50",
            VENTAS: 319,
            ENTRADAS: 0,
            ARCHIVO: "ventas-tv-nuevo.pdf",
            ARCHIVO_HASH: "2".repeat(64),
          },
          {
            CONTRATO: "367820",
            FECHA: "8/6/26 8:10 PM",
            VENDEDOR: "ARI2026",
            CLIENTE: "CLIENTE NUEVO",
            MODELO: "QLEDTV 50",
            VENTAS: "319.00",
            ENTRADAS: "0.00",
            ARCHIVO: "ventas-tv-nuevo-copia.pdf",
            ARCHIVO_HASH: "3".repeat(64),
          },
        ],
        ventasCelular: [],
      },
    });

    expect(resultado).toEqual(
      expect.objectContaining({
        carga: cargaExistente,
        esCargaNueva: false,
        archivosAgregados: 1,
        archivosOmitidos: 2,
        registrosAgregados: 1,
        registrosOmitidos: 2,
      }),
    );
    expect(cargaExistente.update).toHaveBeenCalledWith(
      expect.objectContaining({
        registrosVentasTv: 2,
        totalVentasTv: 669,
        totalEntradasTv: 0,
      }),
      expect.objectContaining({ transaction: expect.any(Object) }),
    );
    const agregados = ControlFinancieroRegistro.bulkCreate.mock.calls[0][0];
    expect(agregados).toHaveLength(1);
    expect(agregados[0]).toEqual(
      expect.objectContaining({
        tipoRegistro: "VENTA_TV",
        contrato: "367820",
        archivoOrigen: "ventas-tv-nuevo.pdf",
      }),
    );
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

  test("identifica dias sin reportes de TV o celular", () => {
    const cobertura = construirCoberturaReportes({
      fechaInicio: "2026-08-01",
      fechaFin: "2026-08-03",
      cargas: [
        {
          estado: "ACTIVA",
          fechaReporte: "2026-08-01",
          registrosVentasTv: 2,
          registrosVentasCelular: 3,
        },
        {
          estado: "ACTIVA",
          fechaReporte: "2026-08-02",
          registrosVentasTv: 1,
          registrosVentasCelular: 0,
        },
      ],
    });

    expect(cobertura.resumen).toEqual({
      diasCompletos: 1,
      diasFaltaTv: 1,
      diasFaltaCelular: 2,
      diasSinReportes: 1,
      diasConPendientes: 2,
    });
    expect(cobertura.dias).toEqual([
      expect.objectContaining({ fecha: "2026-08-01", estado: "COMPLETO" }),
      expect.objectContaining({
        fecha: "2026-08-02",
        tv: true,
        celular: false,
        estado: "FALTA_CELULAR",
      }),
      expect.objectContaining({
        fecha: "2026-08-03",
        tv: false,
        celular: false,
        estado: "SIN_REPORTES",
      }),
    ]);
  });
});
