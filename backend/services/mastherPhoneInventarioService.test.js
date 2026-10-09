const Entrega = require("../models/Entrega");
const LogisticaMastherPhoneIngreso = require("../models/LogisticaMastherPhoneIngreso");
const Modelo = require("../models/Modelo");
const Venta = require("../models/Venta");
const {
  calculateControlRow,
  calculateEntryAmounts,
  collectSalesOperations,
  deleteEntry,
  getReport,
  getWeekStart,
  parseEntryDateTime,
  registerEntry,
  updateEntry,
  validateWeekStart,
} = require("./mastherPhoneInventarioService");

const reconciliation = (modelId, week, stockCreditek) => [
  `${modelId}:${week}`,
  { stockCreditek },
];

describe("inventario semanal Masther Phone", () => {
  afterEach(() => jest.restoreAllMocks());

  test("aplica el ejemplo obligatorio y conserva el saldo la semana siguiente", () => {
    const weeklySales = new Map([
      ["1:2026-10-05", 23],
      ["1:2026-10-12", 10],
    ]);
    const reconciliations = new Map([
      reconciliation(1, "2026-10-05", 7),
      reconciliation(1, "2026-10-12", 2),
    ]);

    const firstWeek = calculateControlRow({
      modelId: 1,
      brand: "Marca",
      model: "Modelo 256 GB",
      accumulatedEntries: 90,
      controlStartDate: "2026-10-05",
      selectedWeek: "2026-10-05",
      weeklySales,
      reconciliations,
      preControlSales: 0,
    });
    const nextWeek = calculateControlRow({
      modelId: 1,
      brand: "Marca",
      model: "Modelo 256 GB",
      accumulatedEntries: 90,
      controlStartDate: "2026-10-05",
      selectedWeek: "2026-10-12",
      weeklySales,
      reconciliations,
      preControlSales: 0,
    });

    expect(firstWeek).toMatchObject({
      cantidad: 90,
      ventasTotalesSemana: 23,
      stockCreditek: 7,
      mastherPhone: 16,
      totalBodega: 74,
    });
    expect(nextWeek).toMatchObject({
      ventasTotalesSemana: 10,
      stockCreditek: 2,
      mastherPhone: 8,
      totalBodega: 66,
    });

    const accumulatedPeriod = calculateControlRow({
      modelId: 1,
      brand: "Marca",
      model: "Modelo 256 GB",
      accumulatedEntries: 90,
      controlStartDate: "2026-10-05",
      selectedStartWeek: "2026-10-05",
      selectedEndWeek: "2026-10-12",
      weeklySales,
      reconciliations,
      preControlSales: 0,
    });
    expect(accumulatedPeriod).toMatchObject({
      ventasTotalesSemana: 33,
      stockCreditek: 9,
      mastherPhone: 24,
      totalBodega: 66,
    });
  });

  test("calcula subtotal, IVA y total con seis decimales y separador punto", () => {
    expect(calculateEntryAmounts("10.123456", 3)).toEqual({
      precioUnitario: "10.123456",
      subtotal: "30.370368",
      iva: "4.555555",
      total: "34.925923",
    });
    expect(() => calculateEntryAmounts("10.1234567", 1)).toThrow(
      "máximo seis decimales",
    );
    expect(() => calculateEntryAmounts("10,25", 1)).toThrow("debe usar punto");
  });

  test("permite registrar el precio unitario como pendiente", () => {
    expect(calculateEntryAmounts("", 3)).toEqual({
      precioUnitario: null,
      subtotal: null,
      iva: null,
      total: null,
    });
  });

  test("no inventa saldo si falta una conciliacion semanal", () => {
    const row = calculateControlRow({
      modelId: 1,
      brand: "Marca",
      model: "Modelo",
      accumulatedEntries: 20,
      controlStartDate: "2026-10-05",
      selectedWeek: "2026-10-12",
      weeklySales: new Map([
        ["1:2026-10-05", 4],
        ["1:2026-10-12", 2],
      ]),
      reconciliations: new Map([reconciliation(1, "2026-10-12", 1)]),
      preControlSales: 0,
    });

    expect(row.mastherPhone).toBe(1);
    expect(row.totalBodega).toBeNull();
    expect(row.semanasPendientes).toEqual(["2026-10-05"]);
  });

  test("obliga a cubrir con stock propio las ventas anteriores al primer ingreso", () => {
    const base = {
      modelId: 1,
      brand: "Marca",
      model: "Modelo",
      accumulatedEntries: 30,
      controlStartDate: "2026-10-08",
      selectedWeek: "2026-10-05",
      weeklySales: new Map([["1:2026-10-05", 10]]),
      preControlSales: 5,
    };

    const invalid = calculateControlRow({
      ...base,
      reconciliations: new Map([reconciliation(1, "2026-10-05", 4)]),
    });
    const valid = calculateControlRow({
      ...base,
      reconciliations: new Map([reconciliation(1, "2026-10-05", 5)]),
    });

    expect(invalid.mastherPhone).toBeNull();
    expect(invalid.totalBodega).toBeNull();
    expect(valid.mastherPhone).toBe(5);
    expect(valid.totalBodega).toBe(25);
  });

  test("calcula semanas de lunes a domingo y rechaza otro inicio", () => {
    expect(getWeekStart("2026-10-11")).toBe("2026-10-05");
    expect(validateWeekStart("2026-10-05")).toBe("2026-10-05");
    expect(() => validateWeekStart("2026-10-06")).toThrow(
      "La semana debe iniciar un lunes.",
    );
  });

  test("interpreta la fecha y hora de ingreso en America/Guayaquil", () => {
    expect(parseEntryDateTime("2026-10-09T14:45").toISOString()).toBe(
      "2026-10-09T19:45:00.000Z",
    );
    expect(() => parseEntryDateTime("2026-10-09")).toThrow(
      "fecha y hora de ingreso",
    );
    expect(() => parseEntryDateTime("2026-10-09T25:00")).toThrow(
      "no es valida",
    );
  });

  test("acepta un rango elegido y lo ajusta a semanas completas", async () => {
    jest.spyOn(LogisticaMastherPhoneIngreso, "findAll").mockResolvedValue([]);

    const report = await getReport({
      dateFrom: "2026-10-01",
      dateTo: "2026-10-31",
    });

    expect(report).toMatchObject({
      fechaInicioSolicitada: "2026-10-01",
      fechaFinSolicitada: "2026-10-31",
      semanaInicio: "2026-09-28",
      semanaFin: "2026-11-01",
      esSemanaUnica: false,
    });
    await expect(
      getReport({ dateFrom: "2026-10-31", dateTo: "2026-10-01" }),
    ).rejects.toThrow("La fecha inicial no puede ser posterior");
  });

  test("un reintento con la misma clave no crea un segundo ingreso", async () => {
    jest.spyOn(Modelo, "findOne").mockResolvedValue({ id: 1 });
    jest.spyOn(LogisticaMastherPhoneIngreso, "findOne").mockResolvedValue({
      id: 9,
      modeloId: 1,
      cantidad: 3,
      fechaIngreso: new Date("2026-10-08T15:30:00.000Z"),
      bodega: "PROVEEDOR",
      precioUnitario: "50.00",
      registradoPorId: 2,
    });
    const create = jest
      .spyOn(LogisticaMastherPhoneIngreso, "create")
      .mockResolvedValue(null);

    const result = await registerEntry(
      {
        modeloId: 1,
        cantidad: 3,
        fechaIngreso: "2026-10-08T10:30",
        bodega: "PROVEEDOR",
        precioUnitario: 50,
        requestKey: "12345678-1234-1234-1234-123456789012",
      },
      2,
    );

    expect(result.duplicado).toBe(true);
    expect(result.ingreso.id).toBe(9);
    expect(create).not.toHaveBeenCalled();
  });

  test("exige elegir una de las dos bodegas permitidas", async () => {
    await expect(
      registerEntry({
        modeloId: 1,
        cantidad: 3,
        fechaIngreso: "2026-10-08T10:30",
        bodega: "OTRA",
        precioUnitario: 50,
        requestKey: "12345678-1234-1234-1234-123456789012",
      }),
    ).rejects.toThrow("Selecciona una bodega válida.");
  });

  test("edita un movimiento y registra el usuario que hizo la correccion", async () => {
    const entry = {
      id: 12,
      modeloId: 1,
      cantidad: 3,
      fechaIngreso: new Date("2026-10-08T15:30:00.000Z"),
      bodega: "PROVEEDOR",
      precioUnitario: "50.00",
      registradoPorId: 2,
      update: jest.fn(async (changes) => Object.assign(entry, changes)),
    };
    jest.spyOn(LogisticaMastherPhoneIngreso, "findByPk").mockResolvedValue(entry);
    jest.spyOn(Modelo, "findOne").mockResolvedValue({ id: 2 });

    const result = await updateEntry(
      12,
      {
        modeloId: 2,
        cantidad: 5,
        fechaIngreso: "2026-10-09T14:45",
        bodega: "CREDITEK",
        precioUnitario: 60,
      },
      8,
    );

    expect(entry.update).toHaveBeenCalledWith({
      modeloId: 2,
      cantidad: 5,
      precioUnitario: "60.000000",
      subtotal: "300.000000",
      iva: "45.000000",
      total: "345.000000",
      fechaIngreso: new Date("2026-10-09T19:45:00.000Z"),
      bodega: "CREDITEK",
      actualizadoPorId: 8,
    });
    expect(result).toMatchObject({
      modeloId: 2,
      cantidad: 5,
      bodega: "CREDITEK",
      precioUnitario: 60,
      subtotal: 300,
      iva: 45,
      total: 345,
      actualizadoPorId: 8,
      fechaIngreso: "2026-10-09T19:45:00.000Z",
    });
  });

  test("elimina un movimiento independiente", async () => {
    const entry = { destroy: jest.fn().mockResolvedValue(undefined) };
    jest.spyOn(LogisticaMastherPhoneIngreso, "findByPk").mockResolvedValue(entry);

    await expect(deleteEntry(12)).resolves.toEqual({ id: 12 });
    expect(entry.destroy).toHaveBeenCalledTimes(1);
  });

  test("no elimina cuando el movimiento no existe", async () => {
    jest.spyOn(LogisticaMastherPhoneIngreso, "findByPk").mockResolvedValue(null);

    await expect(deleteEntry(999)).rejects.toMatchObject({
      code: "ENTRY_NOT_FOUND",
      httpStatus: 404,
    });
  });

  test("suma varios movimientos independientes del mismo modelo", async () => {
    const model = {
      id: 1,
      nombre: "Modelo 256 GB",
      dispositivoMarca: { marca: { id: 7, nombre: "Marca" } },
    };
    jest.spyOn(LogisticaMastherPhoneIngreso, "findAll").mockResolvedValue([
      {
        get: () => ({
          modeloId: 1,
          cantidad: 7,
          fechaIngreso: "2026-10-05",
          bodega: "CREDITEK",
          modelo: model,
        }),
      },
      {
        get: () => ({
          modeloId: 1,
          cantidad: 40,
          fechaIngreso: "2026-10-05",
          bodega: "PROVEEDOR",
          modelo: model,
        }),
      },
      {
        get: () => ({
          modeloId: 1,
          cantidad: 50,
          fechaIngreso: "2026-10-08",
          bodega: "PROVEEDOR",
          modelo: model,
        }),
      },
    ]);
    jest.spyOn(Entrega, "findAll").mockResolvedValue([]);
    jest.spyOn(Venta, "findAll").mockResolvedValue([
      {
        id: 11,
        fecha: "2026-10-09",
        detalleVenta: [{ modeloId: 1, cantidad: 23 }],
      },
    ]);

    const report = await getReport({ weekStart: "2026-10-05" });

    expect(report.filas[0]).toMatchObject({
      cantidad: 90,
      stockProveedor: 90,
      stockCreditek: 7,
      ventasTotalesSemana: 23,
      cantidadBodegaCreditek: 7,
      cantidadBodegaProveedor: 90,
      mastherPhone: 16,
      ventasProveedor: 16,
      totalBodega: 74,
    });
  });

  test("evita duplicar entregas vinculadas y coincidencias antiguas sin ventaId", async () => {
    jest.spyOn(Entrega, "findAll").mockResolvedValue([
      {
        id: 1,
        ventaId: 10,
        fecha: "2026-10-07",
        detalleEntregas: [{ modeloId: 1, cantidad: 3 }],
      },
      {
        id: 2,
        ventaId: null,
        clienteId: 200,
        usuarioAgenciaId: 5,
        fecha: "2026-10-07",
        detalleEntregas: [{ modeloId: 1, cantidad: 2 }],
      },
    ]);
    jest.spyOn(Venta, "findAll").mockResolvedValue([
      {
        id: 10,
        fecha: "2026-10-07",
        detalleVenta: [{ modeloId: 1, cantidad: 3 }],
      },
      {
        id: 11,
        clienteId: 200,
        usuarioAgenciaId: 5,
        fecha: "2026-10-08",
        detalleVenta: [{ modeloId: 1, cantidad: 2 }],
      },
    ]);

    const operations = await collectSalesOperations({
      modelIds: [1],
      dateFrom: "2026-10-05",
      dateTo: "2026-10-11",
    });

    expect(operations.reduce((sum, item) => sum + item.cantidad, 0)).toBe(5);
  });
});
