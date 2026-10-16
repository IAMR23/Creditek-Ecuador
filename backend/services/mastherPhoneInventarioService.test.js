const { Op } = require("sequelize");
const { sequelize } = require("../config/db");
const LogisticaMastherPhoneCierre = require("../models/LogisticaMastherPhoneCierre");
const LogisticaMastherPhoneCierreDetalle = require("../models/LogisticaMastherPhoneCierreDetalle");
const Venta = require("../models/Venta");
const {
  calculateEntryAmounts,
  closeWeek,
  collectSalesOperations,
  getWeekStart,
  getReport,
  parseEntryDateTime,
  simulateInventory,
  validateWeekStart,
} = require("./mastherPhoneInventarioService");

const timestamp = (value) => new Date(`${value}-05:00`).getTime();
const metadata = new Map([
  [
    1,
    {
      modeloId: 1,
      marcaId: 1,
      marca: "Marca",
      modelo: "X5C Plus",
      producto: "Marca X5C Plus",
    },
  ],
]);

const entry = (id, origin, quantity, dateTime) => ({
  tipo: "INGRESO",
  id,
  modeloId: 1,
  origen: origin,
  cantidad: quantity,
  fecha: dateTime.slice(0, 10),
  timestamp: timestamp(dateTime),
});

const sale = (id, quantity, date) => ({
  tipo: "VENTA",
  id,
  modeloId: 1,
  cantidad: quantity,
  fecha: date,
  timestamp: timestamp(`${date}T00:00:00`),
});

describe("inventario semanal Masther Phone", () => {
  afterEach(() => jest.restoreAllMocks());

  test("aplica el caso X5C Plus y arrastra cada origen sin duplicar ingresos", () => {
    const firstWeek = simulateInventory({
      events: [
        entry(1, "PROVEEDOR", 90, "2026-10-01T08:00:00"),
        entry(2, "CREDITEK", 7, "2026-10-01T08:05:00"),
        sale(10, 23, "2026-10-02"),
      ],
      periodStart: "2026-10-01",
      periodEndExclusive: "2026-10-08",
      metadata,
    })[0];

    expect(firstWeek).toMatchObject({
      stockInicialCreditek: 0,
      stockInicialProveedor: 0,
      ingresosCreditek: 7,
      ingresosProveedor: 90,
      ventasTotales: 23,
      ventasCreditek: 7,
      ventasProveedor: 16,
      saldoFinalCreditek: 0,
      saldoFinalProveedor: 74,
      salidasSinStock: 0,
    });

    const secondWeek = simulateInventory({
      initialBalances: new Map([[1, { CREDITEK: 0, PROVEEDOR: 74 }]]),
      events: [sale(11, 24, "2026-10-09")],
      periodStart: "2026-10-08",
      periodEndExclusive: "2026-10-15",
      metadata,
    })[0];

    expect(secondWeek).toMatchObject({
      stockInicialCreditek: 0,
      stockInicialProveedor: 74,
      ingresosCreditek: 0,
      ingresosProveedor: 0,
      ventasProveedor: 24,
      saldoFinalCreditek: 0,
      saldoFinalProveedor: 50,
    });

    const thirdWeek = simulateInventory({
      initialBalances: new Map([[1, { CREDITEK: 0, PROVEEDOR: 50 }]]),
      events: [entry(3, "PROVEEDOR", 20, "2026-10-15T08:00:00")],
      periodStart: "2026-10-15",
      periodEndExclusive: "2026-10-22",
      metadata,
    })[0];

    expect(thirdWeek).toMatchObject({
      stockInicialProveedor: 50,
      ingresosProveedor: 20,
      saldoFinalProveedor: 70,
    });
  });

  test("procesa cronológicamente y no usa un ingreso posterior para una venta anterior", () => {
    const row = simulateInventory({
      events: [
        sale(10, 3, "2026-10-02"),
        entry(1, "PROVEEDOR", 5, "2026-10-02T12:00:00"),
      ],
      periodStart: "2026-10-01",
      periodEndExclusive: "2026-10-08",
      metadata,
    })[0];

    expect(row).toMatchObject({
      ventasTotales: 3,
      ventasProveedor: 0,
      salidasSinStock: 3,
      saldoFinalProveedor: 5,
    });
    expect(row.incidencias).toHaveLength(1);
    expect(row.incidencias[0]).toMatchObject({
      tipo: "VENTA_SIN_EXISTENCIA",
      faltante: 3,
    });
  });

  test("considera como apertura los ingresos de las 00:00 antes de las ventas del día", () => {
    const row = simulateInventory({
      events: [
        entry(1, "CREDITEK", 7, "2026-10-01T00:00:00"),
        entry(2, "PROVEEDOR", 90, "2026-10-01T00:00:00"),
        sale(4975, 1, "2026-10-01"),
      ],
      periodStart: "2026-10-01",
      periodEndExclusive: "2026-10-08",
      metadata,
    })[0];

    expect(row).toMatchObject({
      ventasTotales: 1,
      ventasCreditek: 1,
      ventasProveedor: 0,
      salidasSinStock: 0,
      saldoFinalCreditek: 6,
      saldoFinalProveedor: 90,
    });
    expect(row.incidencias).toHaveLength(0);
  });

  test("conserva saldos en semanas sin movimientos y respeta el límite exclusivo", () => {
    const row = simulateInventory({
      initialBalances: new Map([[1, { CREDITEK: 2, PROVEEDOR: 8 }]]),
      events: [entry(2, "PROVEEDOR", 20, "2026-10-08T00:00:00")],
      periodStart: "2026-10-01",
      periodEndExclusive: "2026-10-08",
      metadata,
    })[0];

    expect(row).toMatchObject({
      stockInicialCreditek: 2,
      stockInicialProveedor: 8,
      ingresosProveedor: 0,
      saldoFinalCreditek: 2,
      saldoFinalProveedor: 8,
    });
  });

  test("consume Creditek primero y registra agotamiento en vez de ocultarlo", () => {
    const row = simulateInventory({
      initialBalances: new Map([[1, { CREDITEK: 2, PROVEEDOR: 3 }]]),
      events: [sale(5, 7, "2026-10-02")],
      periodStart: "2026-10-01",
      periodEndExclusive: "2026-10-08",
      metadata,
    })[0];

    expect(row).toMatchObject({
      ventasTotales: 7,
      ventasCreditek: 2,
      ventasProveedor: 3,
      salidasSinStock: 2,
      saldoFinalCreditek: 0,
      saldoFinalProveedor: 0,
    });
    expect(row.incidencias[0].faltante).toBe(2);
  });

  test("aplica ajustes al origen y conserva la fórmula del saldo", () => {
    const row = simulateInventory({
      initialBalances: new Map([[1, { CREDITEK: 3, PROVEEDOR: 10 }]]),
      events: [
        {
          tipo: "AJUSTE",
          id: 1,
          modeloId: 1,
          origen: "PROVEEDOR",
          cantidad: -2,
          fecha: "2026-10-03",
          timestamp: timestamp("2026-10-03T10:00:00"),
        },
      ],
      periodStart: "2026-10-01",
      periodEndExclusive: "2026-10-08",
      metadata,
    })[0];

    expect(row.ajustesProveedor).toBe(-2);
    expect(row.saldoFinalProveedor).toBe(
      row.stockInicialProveedor +
        row.ingresosProveedor -
        row.ventasProveedor +
        row.ajustesProveedor,
    );
  });

  test("calcula semanas de jueves a miércoles", () => {
    expect(getWeekStart("2026-10-01")).toBe("2026-10-01");
    expect(getWeekStart("2026-10-07")).toBe("2026-10-01");
    expect(getWeekStart("2026-10-08")).toBe("2026-10-08");
    expect(validateWeekStart("2026-10-15")).toBe("2026-10-15");
    expect(() => validateWeekStart("2026-10-14")).toThrow(
      "La semana debe iniciar un jueves.",
    );
  });

  test("interpreta ingresos en America/Guayaquil", () => {
    expect(parseEntryDateTime("2026-10-09T14:45").toISOString()).toBe(
      "2026-10-09T19:45:00.000Z",
    );
  });

  test("mantiene los cálculos existentes de precio e IVA", () => {
    expect(calculateEntryAmounts("10.123456", 3)).toEqual({
      precioUnitario: "10.123456",
      subtotal: "30.370368",
      iva: "4.555555",
      total: "34.925923",
    });
    expect(calculateEntryAmounts("", 3)).toEqual({
      precioUnitario: null,
      subtotal: null,
      iva: null,
      total: null,
    });
  });

  test("rechaza períodos no terminados y un cierre repetido", async () => {
    await expect(
      closeWeek(
        { weekStart: "2026-10-15" },
        1,
        { now: new Date("2026-10-21T23:59:59-05:00") },
      ),
    ).rejects.toMatchObject({ code: "PERIOD_NOT_FINISHED", httpStatus: 409 });

    jest.spyOn(sequelize, "transaction").mockImplementation(async (_options, callback) =>
      callback({ LOCK: { UPDATE: "UPDATE" } }),
    );
    jest.spyOn(LogisticaMastherPhoneCierre, "findOne").mockResolvedValue({ id: 5 });

    await expect(
      closeWeek(
        { weekStart: "2026-10-01" },
        1,
        { now: new Date("2026-10-08T00:00:00-05:00") },
      ),
    ).rejects.toMatchObject({ code: "PERIOD_ALREADY_CLOSED", httpStatus: 409 });
  });

  test("carga el detalle de un cierre en una consulta separada sin alias SQL anidados", async () => {
    const closure = {
      id: 8,
      periodoInicio: "2026-10-01",
      periodoFinExclusivo: "2026-10-08",
      cerradoPorId: 3,
      cerradoEn: new Date("2026-10-08T05:00:00.000Z"),
      get: jest.fn(function get() {
        return { ...this, get: undefined };
      }),
    };
    const model = {
      id: 1,
      nombre: "X5C Plus",
      dispositivoMarca: { marca: { id: 1, nombre: "Marca" } },
    };
    jest.spyOn(LogisticaMastherPhoneCierre, "findOne").mockResolvedValue(closure);
    jest.spyOn(LogisticaMastherPhoneCierreDetalle, "findAll").mockResolvedValue([
      {
        cierreId: 8,
        modeloId: 1,
        origen: "CREDITEK",
        saldoInicial: 7,
        ingresos: 0,
        salidas: 7,
        ajustes: 0,
        saldoFinal: 0,
        modelo: model,
      },
      {
        cierreId: 8,
        modeloId: 1,
        origen: "PROVEEDOR",
        saldoInicial: 90,
        ingresos: 0,
        salidas: 16,
        ajustes: 0,
        saldoFinal: 74,
        modelo: model,
      },
    ]);

    const report = await getReport({ weekStart: "2026-10-01" });

    expect(LogisticaMastherPhoneCierre.findOne.mock.calls[0][0]).not.toHaveProperty(
      "include",
    );
    expect(LogisticaMastherPhoneCierreDetalle.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ where: { cierreId: 8 } }),
    );
    expect(report).toMatchObject({
      estado: "CERRADA",
      filas: [
        expect.objectContaining({
          producto: "Marca X5C Plus",
          ventasCreditek: 7,
          ventasProveedor: 16,
          saldoFinalProveedor: 74,
        }),
      ],
    });
  });

  test("consulta exclusivamente ventas activas por Venta.fecha y DetalleVenta.cantidad", async () => {
    const findSales = jest.spyOn(Venta, "findAll").mockResolvedValue([
      {
        id: 10,
        fecha: "2026-10-02",
        detalleVenta: [{ modeloId: 1, cantidad: 3 }],
      },
    ]);

    const operations = await collectSalesOperations({
      modelIds: [1],
      dateFrom: "2026-10-01",
      dateToExclusive: "2026-10-08",
    });

    expect(operations).toEqual([
      { ventaId: 10, modeloId: 1, fecha: "2026-10-02", cantidad: 3 },
    ]);
    const query = findSales.mock.calls[0][0];
    expect(query.where.activo).toBe(true);
    expect(query.where.fecha[Op.gte]).toBe("2026-10-01");
    expect(query.where.fecha[Op.lt]).toBe("2026-10-08");
    expect(query.include[0]).toMatchObject({ as: "detalleVenta", required: true });
  });
});
