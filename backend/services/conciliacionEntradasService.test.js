jest.mock("../config/db", () => ({
  sequelize: {
    query: jest.fn(),
    transaction: jest.fn(),
  },
}));

jest.mock("../models/CierreCaja/CierreCaja", () => ({
  findAll: jest.fn(),
}));

jest.mock("../models/CierreCaja/MovimientoCaja", () => ({
  findAll: jest.fn(),
}));

jest.mock("../models/ControlFinancieroCarga", () => ({
  findAll: jest.fn(),
  findByPk: jest.fn(),
}));

jest.mock("../models/ControlFinancieroRegistro", () => ({
  findAll: jest.fn(),
}));

jest.mock("../models/ControlFinancieroConciliacionEntrada", () => ({
  create: jest.fn(),
  findOne: jest.fn(),
}));

const {
  conciliarCarga,
  construirResultadosConciliacion,
  normalizarNombre,
  puntuarCoincidenciaParcial,
} = require("./conciliacionEntradasService");
const { sequelize } = require("../config/db");
const CierreCaja = require("../models/CierreCaja/CierreCaja");
const MovimientoCaja = require("../models/CierreCaja/MovimientoCaja");
const ControlFinancieroCarga = require("../models/ControlFinancieroCarga");
const ControlFinancieroRegistro = require("../models/ControlFinancieroRegistro");
const ControlFinancieroConciliacionEntrada = require(
  "../models/ControlFinancieroConciliacionEntrada",
);

const fecha = "2026-07-29";
const cierres = [
  { id: 10, fecha },
  { id: 11, fecha },
];

describe("conciliacionEntradasService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sequelize.query.mockResolvedValue([]);
    sequelize.transaction.mockImplementation(async (callback) =>
      callback({ id: "transaction" }),
    );
  });

  test("normaliza mayusculas, tildes, signos y espacios duplicados", () => {
    expect(normalizarNombre("  José  María-Pérez, Jr. ")).toBe(
      "JOSE MARIA PEREZ JR",
    );
  });

  test("agrupa por cliente y fecha varios movimientos y contratos", () => {
    const calculo = construirResultadosConciliacion({
      fecha,
      cierres,
      movimientos: [
        {
          id: 1,
          cierreId: 10,
          detalle: " entrada. ",
          entidad: "José Pérez",
          valor: "10.00",
        },
        {
          id: 2,
          cierreId: 11,
          detalle: "ENTRADA",
          entidad: "JOSE   PEREZ",
          valor: "14.35",
        },
        {
          id: 3,
          cierreId: 10,
          detalle: "CUOTA",
          entidad: "JOSE PEREZ",
          valor: "50.00",
        },
      ],
      registros: [
        {
          id: 21,
          tipoRegistro: "VENTA_TV",
          cliente: "JOSE PEREZ",
          contrato: "TV-1",
          entradas: "12.00",
        },
        {
          id: 22,
          tipoRegistro: "VENTA_CELULAR",
          cliente: "José Pérez",
          contrato: "CEL-2",
          entradas: "12.35",
        },
      ],
    });

    expect(calculo.resultados).toHaveLength(1);
    expect(calculo.resultados[0]).toEqual(
      expect.objectContaining({
        estado: "CUADRADO",
        tipoCoincidencia: "EXACTA",
        cierreId: null,
        cierreIds: [10, 11],
        movimientoIds: [1, 2],
        registroFinancieroIds: [21, 22],
        contratos: ["CEL-2", "TV-1"],
        entradaCaja: 24.35,
        entradaReal: 24.35,
        diferencia: 0,
      }),
    );
    expect(calculo.resumen).toEqual(
      expect.objectContaining({
        totalDeclarado: 24.35,
        totalReal: 24.35,
        cuadrados: 1,
      }),
    );
  });

  test("no confirma automaticamente el ejemplo de coincidencia parcial", () => {
    expect(
      puntuarCoincidenciaParcial(
        "SEGUNDO CANDO",
        "SEGUNDO FRANCISCO CANDO LOJA",
      ),
    ).toBeGreaterThan(0);

    const calculo = construirResultadosConciliacion({
      fecha,
      cierres: [cierres[0]],
      movimientos: [
        {
          id: 1,
          cierreId: 10,
          detalle: "ENTRADA",
          entidad: "SEGUNDO CANDO",
          valor: "19.00",
        },
      ],
      registros: [
        {
          id: 21,
          tipoRegistro: "VENTA_TV",
          cliente: "SEGUNDO FRANCISCO CANDO LOJA",
          contrato: "4376966",
          entradas: "24.35",
        },
      ],
    });
    const pendiente = calculo.resultados.find(
      (item) => item.estado === "PENDIENTE_REVISION",
    );

    expect(pendiente).toEqual(
      expect.objectContaining({
        clienteCaja: "SEGUNDO CANDO",
        clienteControl: "SEGUNDO FRANCISCO CANDO LOJA",
        entradaCaja: 19,
        entradaReal: 24.35,
        diferencia: -5.35,
        registroFinancieroIds: [],
        confirmadaManualmente: false,
      }),
    );
    expect(pendiente.candidatosControl[0]).toEqual(
      expect.objectContaining({
        clienteControl: "SEGUNDO FRANCISCO CANDO LOJA",
        contratos: ["4376966"],
        registroFinancieroIds: [21],
      }),
    );
    expect(calculo.resultados).toHaveLength(1);
  });

  test("marca coincidencia ambigua cuando existen varios candidatos parciales", () => {
    const calculo = construirResultadosConciliacion({
      fecha,
      cierres: [cierres[0]],
      movimientos: [
        {
          id: 1,
          cierreId: 10,
          detalle: "ENTRADA",
          entidad: "MARIA LOPEZ",
          valor: "20.00",
        },
      ],
      registros: [
        {
          id: 21,
          tipoRegistro: "VENTA_TV",
          cliente: "MARIA JOSE LOPEZ VEGA",
          contrato: "A",
          entradas: "10.00",
        },
        {
          id: 22,
          tipoRegistro: "VENTA_CELULAR",
          cliente: "MARIA ELENA LOPEZ RUIZ",
          contrato: "B",
          entradas: "10.00",
        },
      ],
    });
    const ambiguo = calculo.resultados.find(
      (item) => item.estado === "COINCIDENCIA_AMBIGUA",
    );

    expect(ambiguo.candidatosControl).toHaveLength(2);
    expect(ambiguo.registroFinancieroIds).toEqual([]);
    expect(calculo.resumen.coincidenciasAmbiguas).toBe(1);
  });

  test("usa tolerancia de un centavo y conserva registros sin contraparte", () => {
    const calculo = construirResultadosConciliacion({
      fecha,
      cierres: [cierres[0]],
      movimientos: [
        {
          id: 1,
          cierreId: 10,
          detalle: "ENTRADA",
          entidad: "CLIENTE CUADRADO",
          valor: "19.00",
        },
        {
          id: 2,
          cierreId: 10,
          detalle: "ENTRADA",
          entidad: "SOLO CAJA",
          valor: "5.00",
        },
      ],
      registros: [
        {
          id: 21,
          tipoRegistro: "VENTA_TV",
          cliente: "CLIENTE CUADRADO",
          contrato: "A",
          entradas: "19.01",
        },
        {
          id: 22,
          tipoRegistro: "VENTA_CELULAR",
          cliente: "SOLO CONTROL",
          contrato: "B",
          entradas: "7.00",
        },
        {
          id: 23,
          tipoRegistro: "VENTA_TV",
          cliente: "ENTRADA CERO",
          contrato: "C",
          entradas: "0.00",
        },
      ],
    });

    expect(
      calculo.resultados.find(
        (item) => item.clienteCaja === "CLIENTE CUADRADO",
      ).estado,
    ).toBe("CUADRADO");
    expect(calculo.resumen).toEqual(
      expect.objectContaining({
        totalDeclarado: 24,
        totalReal: 26.01,
        diferenciaTotal: -2.01,
        cuadrados: 1,
        soloCaja: 1,
        soloControl: 1,
      }),
    );
  });

  test("aplica una coincidencia manual como evidencia en una nueva ejecucion", () => {
    const calculo = construirResultadosConciliacion({
      fecha,
      cierres: [cierres[0]],
      movimientos: [
        {
          id: 1,
          cierreId: 10,
          detalle: "ENTRADA",
          entidad: "SEGUNDO CANDO",
          valor: "19.00",
        },
      ],
      registros: [
        {
          id: 21,
          tipoRegistro: "VENTA_TV",
          cliente: "SEGUNDO FRANCISCO CANDO LOJA",
          contrato: "4376966",
          entradas: "24.35",
        },
      ],
      reglasManuales: [
        {
          clienteCajaNormalizado: "SEGUNDO CANDO",
          clienteControlNormalizado: "SEGUNDO FRANCISCO CANDO LOJA",
          confirmadoPor: 7,
          confirmadoEn: "2026-07-29T10:00:00.000Z",
          observacion: "Contrato verificado",
        },
      ],
    });

    expect(calculo.resultados).toHaveLength(1);
    expect(calculo.resultados[0]).toEqual(
      expect.objectContaining({
        estado: "DIFERENCIA",
        tipoCoincidencia: "MANUAL",
        entradaCaja: 19,
        entradaReal: 24.35,
        diferencia: -5.35,
        registroFinancieroIds: [21],
        confirmadaManualmente: true,
        confirmadoPor: 7,
        observacionRevision: "Contrato verificado",
      }),
    );
  });

  test("persiste una ejecucion historica con filtros de fecha, tipo y entrada", async () => {
    ControlFinancieroCarga.findByPk.mockResolvedValue({
      id: 25,
      fechaReporte: fecha,
      estado: "ACTIVA",
    });
    CierreCaja.findAll.mockResolvedValue([{ id: 10, fecha }]);
    MovimientoCaja.findAll.mockResolvedValue([
      {
        id: 1,
        cierreId: 10,
        detalle: "ENTRADA",
        entidad: "CLIENTE",
        valor: "10.00",
      },
    ]);
    ControlFinancieroRegistro.findAll.mockResolvedValue([
      {
        id: 21,
        tipoRegistro: "VENTA_TV",
        cliente: "CLIENTE",
        contrato: "TV-1",
        entradas: "10.00",
      },
    ]);
    ControlFinancieroConciliacionEntrada.findOne.mockResolvedValue(null);
    ControlFinancieroConciliacionEntrada.create.mockImplementation(
      async (payload) => ({
        id: 31,
        createdAt: "2026-07-29T10:00:00.000Z",
        ...payload,
      }),
    );

    const conciliacion = await conciliarCarga({
      cargaId: 25,
      origen: "CARGA",
      usuarioId: 7,
    });

    expect(sequelize.query).toHaveBeenCalledWith(
      expect.stringContaining("pg_advisory_xact_lock"),
      expect.objectContaining({
        replacements: { cargaId: 25 },
        transaction: expect.any(Object),
      }),
    );
    expect(CierreCaja.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { fecha, estadoCierre: "CERRADO" },
      }),
    );
    expect(ControlFinancieroRegistro.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          cargaId: 25,
          tipoRegistro: expect.any(Object),
          entradas: expect.any(Object),
        }),
      }),
    );
    expect(ControlFinancieroConciliacionEntrada.create).toHaveBeenCalledWith(
      expect.objectContaining({
        cargaId: 25,
        fecha,
        cierreId: 10,
        cierreIds: [10],
        origen: "CARGA",
        ejecutadoPor: 7,
        resultados: [
          expect.objectContaining({
            estado: "CUADRADO",
            movimientoIds: [1],
            registroFinancieroIds: [21],
          }),
        ],
      }),
      { transaction: expect.any(Object) },
    );
    expect(conciliacion).toEqual(
      expect.objectContaining({
        id: "31",
        cargaId: 25,
        resumen: expect.objectContaining({ cuadrados: 1 }),
      }),
    );
  });
});
