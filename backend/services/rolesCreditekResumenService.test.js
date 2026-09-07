jest.mock("../config/db", () => ({
  sequelize: {
    transaction: jest.fn(async (callback) => callback({ id: "tx" })),
  },
}));
jest.mock("../models/ControlFinancieroCarga", () => ({}));
jest.mock("../models/ControlFinancieroConciliacionCaja", () => ({
  findAll: jest.fn(),
}));
jest.mock("../models/ControlFinancieroRegistro", () => ({ findAll: jest.fn() }));
jest.mock("../models/EgresoCreditekEntrada", () => ({ findAll: jest.fn() }));
jest.mock("../models/NominaBeneficio", () => ({
  NominaBeneficio: {},
}));
jest.mock("../models/NominaEmpleado", () => ({}));
jest.mock("../models/RolPago", () => ({}));
jest.mock("../models/RolCreditekAjuste", () => ({
  findAll: jest.fn(),
  findOrCreate: jest.fn(),
}));
jest.mock("../models/Usuario", () => ({
  count: jest.fn(),
  findAll: jest.fn(),
}));
jest.mock("./pagosComisionesService", () => ({
  obtenerReportePagosComisiones: jest.fn(),
}));
jest.mock('./nominaNovedadesService', () => ({ listarPeriodo: jest.fn() }));

const ControlFinancieroRegistro = require("../models/ControlFinancieroRegistro");
const ControlFinancieroConciliacionCaja = require(
  "../models/ControlFinancieroConciliacionCaja",
);
const EgresoCreditekEntrada = require("../models/EgresoCreditekEntrada");
const RolCreditekAjuste = require("../models/RolCreditekAjuste");
const Usuario = require("../models/Usuario");
const pagosComisionesService = require("./pagosComisionesService");
const novedadesService = require('./nominaNovedadesService');
const { Op } = require("sequelize");
const { guardarAjustes, guardarNomina, obtenerResumen } = require("./rolesCreditekResumenService");

describe("rolesCreditekResumenService", () => {
  test("incluye tipos nuevos de anticipos en nomina", async () => {
    Usuario.findAll.mockResolvedValue([{ id: 4, nombre: "Prueba", activo: true }]);
    EgresoCreditekEntrada.findAll.mockResolvedValue([{ usuarioId: 4, seccion: "ANTICIPOS", tipo: "T_NUEVO", valor: 18.5 }]);
    const resultado = await obtenerResumen({ anio: 2026, mes: 9 });
    expect(resultado.registros[0]).toMatchObject({ otrosCalculado: 18.5, totalAnticipos: 18.5 });
  });
  test("suma cuotas de prestamos en nomina sin duplicarlas en anticipos", async () => {
    Usuario.findAll.mockResolvedValue([{ id: 4, nombre: "Prueba", activo: true }]);
    EgresoCreditekEntrada.findAll.mockResolvedValue([
      { usuarioId: 4, seccion: "PRESTAMOS", tipo: "OTROS", valor: 25, fecha: "2026-07-01", fechaFin: "2026-12-31" },
      { usuarioId: 4, seccion: "PRESTAMOS", tipo: "PLAN_MOVISTAR", valor: 15, fecha: "2026-08-01", fechaFin: "2026-09-30" },
      { usuarioId: 4, seccion: "PRESTAMOS", tipo: "MECANICA", valor: 25, fecha: "2025-01-01", fechaFin: null },
      { usuarioId: 4, seccion: "PRESTAMOS", tipo: "LENTES", valor: 50, fecha: "2026-10-01", fechaFin: "2026-12-31" },
      { usuarioId: 4, seccion: "ANTICIPOS", tipo: "OTROS", valor: 10 },
    ]);
    const resultado = await obtenerResumen({ anio: 2026, mes: 8 });
    expect(resultado.registros[0]).toMatchObject({ prestamosEgresos: 65, sumanPrestamos: 0, totalAnticipos: 10, totalDescuentos: 10 });
    const filtroPrestamos = EgresoCreditekEntrada.findAll.mock.calls[0][0].where[Op.or][0];
    expect(filtroPrestamos.seccion).toBe("PRESTAMOS");
    expect(filtroPrestamos[Op.and][1][Op.or]).toContainEqual({ fechaFin: null });
  });
  beforeEach(() => {
    jest.clearAllMocks();
    novedadesService.listarPeriodo.mockResolvedValue({ disponible: true, registros: [] });
    Usuario.findAll.mockResolvedValue([]);
    EgresoCreditekEntrada.findAll.mockResolvedValue([]);
    ControlFinancieroRegistro.findAll.mockResolvedValue([]);
    ControlFinancieroConciliacionCaja.findAll.mockResolvedValue([]);
    RolCreditekAjuste.findAll.mockResolvedValue([]);
    pagosComisionesService.obtenerReportePagosComisiones.mockResolvedValue({
      vendedores: [],
    });
  });

  test("COMxVTA coincide con la columna de comisiones de cada cargo y mantiene sanciones separadas", async () => {
    Usuario.findAll.mockResolvedValue([
      { id: 4, nombre: "Vendedor", activo: true },
      { id: 5, nombre: "Jefe", activo: true },
      { id: 6, nombre: "Supervisor", activo: true },
      { id: 7, nombre: "Supervisor sin bono", activo: true },
    ]);
    pagosComisionesService.obtenerReportePagosComisiones.mockResolvedValue({
      vendedores: [
        { usuarioId: 4, cargo: "VENDEDOR", resumenMensual: { totalComisionesSemanaMensual: 150.25, totalPagar: 130.25 }, total: { valorDescontar: 20 } },
        { usuarioId: 5, cargo: "JEFE COMERCIAL", esJefeComercial: true, resumenMensual: { valorComisionSemanal: "95.50", valorComisionMensual: "60.00", totalPagar: 145.5 }, total: { valorDescontar: 10 }, ventasPersonalesVendedor: { resumenMensual: { totalComisionesSemanaMensual: 999 } } },
        { usuarioId: 6, cargoComision: "SUPERVISOR CALL CENTER", resumenMensual: { valorComisionSemanal: 80, valorComisionMensual: 40, totalPagar: 100 }, total: { valorDescontar: 20 } },
        { usuarioId: 7, esSupervisorComercial: true, resumenMensual: { valorComisionSemanal: 0, valorComisionMensual: 0, totalComisionesSemanaMensual: 999 } },
      ],
    });
    const resultado = await obtenerResumen({ anio: 2026, mes: 8 });
    expect(resultado.registros.map(row => row.ingresosComisiones)).toEqual([150.25, 155.5, 120, 0]);
    expect(resultado.registros.map(row => row.descuentosMetaCalculado)).toEqual([20, 10, 20, 0]);
    expect(resultado.totales.ingresosComisiones).toBe(425.75);
    expect(pagosComisionesService.obtenerReportePagosComisiones).toHaveBeenCalledWith({
      year: 2026, month: 8,
      logisticaFechaInicio: "2026-08-01", logisticaFechaFin: "2026-08-31",
    });
  });

  test('adjunta novedades y cálculo solo a la persona y mes correspondientes', async () => {
    Usuario.findAll.mockResolvedValue([{ id: 4, nombre: 'Persona A', activo: true }, { id: 5, nombre: 'Persona B', activo: true }]);
    RolCreditekAjuste.findAll.mockResolvedValue([{ usuarioId: 4, fondosReservaManual: 40.15 }]);
    EgresoCreditekEntrada.findAll.mockResolvedValue([
      { usuarioId: 4, seccion: 'ANTICIPOS', tipo: 'OTROS', valor: 183.5 },
      { usuarioId: 4, seccion: 'PRESTAMOS', valor: 50, fecha: '2026-08-01' },
    ]);
    novedadesService.listarPeriodo.mockResolvedValue({ disponible: true, registros: [{
      id: 1, usuarioId: 4, tipo: 'MATERNIDAD', activo: true, fechaInicio: '2026-08-16', fechaFin: '2026-08-31',
    }] });
    const result = await obtenerResumen({ anio: 2026, mes: 8 });
    expect(result.registros[0].nominaCalculada).toMatchObject({ sueldoAPagar: 301.25, iess: 45.55, fondosReserva: 40.15, totalEgresos: 279.05, valorRecibir: 62.35, subsidioIessInformativo: 180.75 });
    expect(result.registros[1].nominaCalculada).toBeUndefined();
    expect(result.registros[1].novedadesNomina).toEqual([]);
  });

  test("Nómina usa el mes calendario de logística y conserva las comisiones comerciales", async () => {
    Usuario.findAll.mockResolvedValue([
      { id: 13, nombre: "Bryan", activo: true },
      { id: 85, nombre: "Holger", activo: true },
      { id: 75, nombre: "Paul", activo: true },
      { id: 4, nombre: "Vendedor", activo: true },
      { id: 5, nombre: "Supervisor", activo: true },
    ]);
    pagosComisionesService.obtenerReportePagosComisiones.mockImplementation(async (params) => ({
      vendedores: [
        { usuarioId: 4, cargo: "VENDEDOR", resumenMensual: { totalComisionesSemanaMensual: 150.25 }, total: { valorDescontar: 20 } },
        { usuarioId: 5, cargo: "SUPERVISOR", resumenMensual: { valorComisionSemanal: 80, valorComisionMensual: 40 } },
      ],
      logistica: [
        { usuarioId: 13, cargo: "ENCARGADO DE LOGISTICA", resumenMensual: { totalPagar: params.logisticaFechaInicio === "2026-08-01" && params.logisticaFechaFin === "2026-08-31" ? 142.5 : 166 } },
        { usuarioId: 85, cargo: "CHOFER", resumenMensual: { totalPagar: 95 } },
        { usuarioId: 75, cargo: "CHOFER", resumenMensual: { totalPagar: 82 } },
      ],
    }));
    const resultado = await obtenerResumen({ anio: 2026, mes: 8 });
    expect(resultado.registros.map((row) => row.ingresosComisiones)).toEqual([142.5, 95, 82, 150.25, 120]);
    expect(resultado.registros.find((row) => row.usuarioId === 4).descuentosMetaCalculado).toBe(20);
    expect(pagosComisionesService.obtenerReportePagosComisiones).toHaveBeenCalledTimes(1);
    expect(pagosComisionesService.obtenerReportePagosComisiones).toHaveBeenCalledWith({
      year: 2026, month: 8,
      logisticaFechaInicio: "2026-08-01", logisticaFechaFin: "2026-08-31",
    });
  });

  test.each([
    [2026, 2, "2026-02-01", "2026-02-28"],
    [2028, 2, "2028-02-01", "2028-02-29"],
    [2026, 4, "2026-04-01", "2026-04-30"],
    [2026, 12, "2026-12-01", "2026-12-31"],
  ])("limita logística al mes calendario %i/%i", async (anio, mes, inicio, fin) => {
    await obtenerResumen({ anio, mes });
    expect(pagosComisionesService.obtenerReportePagosComisiones).toHaveBeenCalledWith({
      year: anio, month: mes, logisticaFechaInicio: inicio, logisticaFechaFin: fin,
    });
  });

  test("consolida valores automaticos, manuales y total por colaborador", async () => {
    Usuario.findAll.mockResolvedValue([
      {
        id: 4,
        cedula: "0102030405",
        nombre: "Ana Perez",
        activo: true,
        fechaIngreso: "2026-01-15",
        fechaSalida: null,
        rolPagoId: 2,
        rolPago: {
          id: 2,
          cargo: "VENDEDOR",
          sueldoBase: "482.00",
          sueldoExtra: "68.00",
        },
        nominaEmpleados: [
          {
            id: 8,
            rolPagoId: 2,
            sueldo: "550.00",
            cargo: "VENDEDOR NUEVA AURORA",
            estado: "ACTIVO",
            beneficios: [{ tipoBeneficio: "FONDOS_RESERVA", activo: true }],
          },
        ],
      },
    ]);
    EgresoCreditekEntrada.findAll.mockResolvedValue([
      { usuarioId: 4, seccion: "ANTICIPOS", tipo: "TRANSFERENCIAS", valor: "5.00" },
      { usuarioId: 4, seccion: "ANTICIPOS", tipo: "CAJAS", valor: "20.00" },
      { usuarioId: 4, seccion: "ANTICIPOS", tipo: "ENTRADAS", valor: "30.00" },
      { usuarioId: 4, seccion: "ANTICIPOS", tipo: "DESCUENTOS", valor: "2.00" },
      { usuarioId: 4, seccion: "ANTICIPOS", tipo: "JEFES", valor: "6.00" },
      { usuarioId: 4, seccion: "ANTICIPOS", tipo: "MULTAS_FACTURACION", valor: "4.00" },
      { usuarioId: 4, seccion: "ANTICIPOS", tipo: "OTROS", valor: "7.00" },
    ]);
    ControlFinancieroRegistro.findAll.mockResolvedValueOnce([]);
    RolCreditekAjuste.findAll.mockResolvedValue([
      {
        usuarioId: 4,
        adelantosTransfer: "10.00",
        deudaJimena: "1.00",
        atrasos: "2.00",
        diasNoLaborables: "3.00",
        multasFacturacionManual: null,
        planmovi: "6.00",
        prestamo: "7.00",
        mecanica: "8.00",
        pagosLentes: "9.00",
        sueldo: "50.00",
        descuentosMetaManual: null,
        cajaGeneralManual: null,
        entradasManual: null,
        descuentosManual: null,
      },
    ]);
    pagosComisionesService.obtenerReportePagosComisiones.mockResolvedValue({
      vendedores: [
        {
          usuarioId: 4,
          total: { valorDescontar: 7 },
          resumenMensual: { totalComisionesSemanaMensual: 123.45 },
        },
      ],
    });

    const resultado = await obtenerResumen({ anio: 2026, mes: 8 });

    expect(EgresoCreditekEntrada.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          activo: true,
          [Op.or]: expect.arrayContaining([
            { fecha: { [Op.between]: ["2026-08-01", "2026-08-31"] } },
            expect.objectContaining({ fecha: null }),
          ]),
        }),
      }),
    );
    expect(resultado.registros).toEqual([
      expect.objectContaining({
        usuarioId: 4,
        cedula: "0102030405",
        fechaIngreso: "2026-01-15",
        fechaSalida: null,
        cargo: "VENDEDOR",
        rolPagoId: 2,
        rolPagoSueldoBase: 482,
        rolPagoSueldoExtra: 68,
        fondoReservaActivo: true,
        ingresosComisiones: 123.45,
        adelantosTransfer: 10,
        descuentosMeta: 7,
        descuentosMetaCalculado: 7,
        descuentosMetaManual: null,
        cajaGeneral: 20,
        cajaGeneralCalculado: 20,
        cajaGeneralManual: null,
        entradas: 30,
        entradasCalculado: 30,
        entradasManual: null,
        transferencias: 5,
        transferenciasCalculado: 5,
        transferenciasManual: null,
        descuentos: 2,
        descuentosCalculado: 2,
        descuentosManual: null,
        jefes: 6,
        jefesCalculado: 6,
        jefesManual: null,
        deudaJimena: 1,
        atrasos: 2,
        diasNoLaborables: 3,
        multasFacturacion: 4,
        multasFacturacionCalculado: 4,
        multasFacturacionManual: null,
        otros: 7,
        otrosCalculado: 7,
        otrosManual: null,
        totalAnticipos: 97,
        planmovi: 6,
        prestamo: 7,
        mecanica: 8,
        pagosLentes: 9,
        sueldo: 50,
        sumanPrestamos: 30,
        totalDescuentos: 127,
        totalNomina: -3.55,
        totalPagarNomina: 46.45,
      }),
    ]);
    expect(resultado.totales.totalAnticipos).toBe(97);
    expect(resultado.totales.ingresosComisiones).toBe(123.45);
    expect(resultado.totales.sumanPrestamos).toBe(30);
    expect(resultado.totales.totalDescuentos).toBe(127);
    expect(resultado.totales.totalNomina).toBe(-3.55);
    expect(resultado.totales.totalPagarNomina).toBe(46.45);
    expect(resultado.totales.sueldo).toBe(50);
    expect(pagosComisionesService.obtenerReportePagosComisiones).toHaveBeenCalledWith({
      year: 2026,
      month: 8,
      logisticaFechaInicio: "2026-08-01",
      logisticaFechaFin: "2026-08-31",
    });
  });

  test("incluye en ingresos todas las personas visibles en pagos comisiones", async () => {
    Usuario.findAll.mockResolvedValue([
      { id: 4, nombre: "Ana Perez", activo: true },
    ]);
    pagosComisionesService.obtenerReportePagosComisiones.mockResolvedValue({
      vendedores: [
        {
          usuarioId: 4,
          nombre: "Ana Perez",
          cargo: "JEFE COMERCIAL",
          resumenMensual: { totalComisionesSemanaMensual: 123.45 },
        },
      ],
      logistica: [
        {
          usuarioId: 9,
          nombre: "Luis Logistica",
          cargo: "REPARTIDOR",
          resumenMensual: { totalPagar: 18.5 },
        },
      ],
    });

    const resultado = await obtenerResumen({ anio: 2026, mes: 8 });

    expect(resultado.ingresos).toEqual([
      expect.objectContaining({
        usuarioId: 4,
        nombre: "Ana Perez",
        ingresosComisiones: 123.45,
        tiposIngreso: ["comercial"],
      }),
      expect.objectContaining({
        usuarioId: 9,
        nombre: "Luis Logistica",
        ingresosComisiones: 18.5,
        tiposIngreso: ["logistica"],
      }),
    ]);
    expect(resultado.registros).toHaveLength(1);
    expect(resultado.totales.ingresosComisiones).toBe(141.95);
  });

  test("permite reemplazar valores calculados con ajustes manuales", async () => {
    Usuario.findAll.mockResolvedValue([
      { id: 4, nombre: "Ana Perez", activo: true },
    ]);
    EgresoCreditekEntrada.findAll.mockResolvedValue([
      { usuarioId: 4, seccion: "ANTICIPOS", tipo: "CAJAS", valor: "20.00" },
      { usuarioId: 4, seccion: "ENTRADAS", valor: "30.00" },
      { usuarioId: 4, seccion: "ANTICIPOS", tipo: "DESCUENTOS", valor: "2.00" },
      { usuarioId: 4, seccion: "ANTICIPOS", tipo: "MULTAS_FACTURACION", valor: "4.00" },
    ]);
    ControlFinancieroRegistro.findAll.mockResolvedValueOnce([]);
    RolCreditekAjuste.findAll.mockResolvedValue([
      {
        usuarioId: 4,
        descuentosMetaManual: "9.00",
        cajaGeneralManual: "44.00",
        entradasManual: null,
        descuentosManual: "0.00",
        multasFacturacionManual: "6.00",
      },
    ]);
    pagosComisionesService.obtenerReportePagosComisiones.mockResolvedValue({
      vendedores: [
        {
          usuarioId: 4,
          total: { valorDescontar: 7 },
          resumenMensual: { totalComisionesSemanaMensual: 123.45 },
        },
      ],
    });

    const resultado = await obtenerResumen({ anio: 2026, mes: 8 });

    expect(resultado.registros).toEqual([
      expect.objectContaining({
        descuentosMeta: 9,
        descuentosMetaCalculado: 7,
        descuentosMetaManual: 9,
        cajaGeneral: 44,
        cajaGeneralCalculado: 20,
        cajaGeneralManual: 44,
        entradas: 30,
        entradasCalculado: 30,
        entradasManual: null,
        descuentos: 0,
        descuentosCalculado: 2,
        descuentosManual: 0,
        multasFacturacion: 6,
        multasFacturacionCalculado: 4,
        multasFacturacionManual: 6,
        totalAnticipos: 89,
        totalDescuentos: 89,
      }),
    ]);
  });

  test("suma cajas no en cierre de control financiero al responsable", async () => {
    Usuario.findAll.mockResolvedValue([
      { id: 4, nombre: "Ana Perez", activo: true },
    ]);
    ControlFinancieroRegistro.findAll.mockResolvedValueOnce([
      {
        id: 77,
        cargaId: 9,
        responsablePagoEntradaId: 4,
        pagosCuotas: "14.00",
      },
    ]);
    ControlFinancieroConciliacionCaja.findAll.mockResolvedValue([
      {
        toJSON: () => ({
          id: 10,
          cargaId: 9,
          resultados: [
            {
              controlFinancieroRegistroId: 77,
              estado: "NO_EN_CIERRE",
            },
          ],
          createdAt: "2026-08-26T12:00:00.000Z",
        }),
      },
    ]);

    const resultado = await obtenerResumen({ anio: 2026, mes: 8 });

    expect(ControlFinancieroRegistro.findAll.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        where: expect.not.objectContaining({
          fecha: expect.anything(),
        }),
        include: [
          expect.objectContaining({
            as: "carga",
            where: {
              estado: "ACTIVA",
              fechaReporte: { [Op.between]: ["2026-08-01", "2026-08-31"] },
            },
          }),
        ],
      }),
    );
    expect(resultado.registros).toEqual([
      expect.objectContaining({
        usuarioId: 4,
        cajaGeneral: 14,
        cajaGeneralCalculado: 14,
      }),
    ]);
  });

  test("guarda campos manuales y reemplazos de calculados auditados", async () => {
    Usuario.count.mockResolvedValue(1);
    const ajuste = { update: jest.fn().mockResolvedValue(undefined) };
    RolCreditekAjuste.findOrCreate.mockResolvedValue([ajuste, true]);

    const resultado = await guardarAjustes(
      {
        anio: 2026,
        mes: 8,
        registros: [
          {
            usuarioId: 4,
            adelantosTransfer: "8.75",
            deudaJimena: "10,25",
            atrasos: 2,
            diasNoLaborables: 0,
            multasFacturacionManual: "5.50",
            planmovi: 1,
            prestamo: "2,50",
            mecanica: 3,
            pagosLentes: "4,75",
            sueldo: "11,25",
            descuentosMetaManual: "",
            cajaGeneralManual: 999,
            entradasManual: null,
            transferenciasManual: "12.00",
            descuentosManual: "4,25",
            jefesManual: "",
            otrosManual: null,
          },
        ],
      },
      7,
    );

    const esperado = {
      usuarioId: 4,
      anio: 2026,
      mes: 8,
      adelantosTransfer: 8.75,
      deudaJimena: 10.25,
      atrasos: 2,
      diasNoLaborables: 0,
      multasFacturacionManual: 5.5,
      planmovi: 1,
      prestamo: 2.5,
      mecanica: 3,
      pagosLentes: 4.75,
      sueldo: 11.25,
      descuentosMetaManual: null,
      cajaGeneralManual: 999,
      entradasManual: null,
      transferenciasManual: 12,
      descuentosManual: 4.25,
      jefesManual: null,
      otrosManual: null,
      actualizadoPorId: 7,
    };
    expect(RolCreditekAjuste.findOrCreate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { usuarioId: 4, anio: 2026, mes: 8 }, defaults: esperado }),
    );
    expect(ajuste.update).toHaveBeenCalledWith(esperado, {
      transaction: { id: "tx" },
    });
    expect(resultado.total).toBe(1);
  });

  test("rechaza valores manuales negativos", async () => {
    await expect(
      guardarAjustes(
        {
          anio: 2026,
          mes: 8,
          registros: [{ usuarioId: 4, deudaJimena: -1 }],
        },
        7,
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(Usuario.count).not.toHaveBeenCalled();
  });
});

describe("fondos de reserva de nomina", () => {
  beforeEach(() => jest.clearAllMocks());

  test("guarda todos los colaboradores del periodo en una transaccion sin modificar otros ajustes", async () => {
    Usuario.count.mockResolvedValue(2);
    const update = jest.fn().mockResolvedValue(undefined);
    RolCreditekAjuste.findOrCreate.mockResolvedValue([{ update }, false]);
    await guardarNomina({ anio: 2026, mes: 9, registros: [
      { usuarioId: 4, fondosReservaManual: "25,50", prestamo: 999 },
      { usuarioId: 5, fondosReservaManual: 0 },
    ] }, 7);
    expect(update.mock.calls).toEqual([
      [{ usuarioId: 4, anio: 2026, mes: 9, fondosReservaManual: 25.5, actualizadoPorId: 7 }, { transaction: { id: "tx" } }],
      [{ usuarioId: 5, anio: 2026, mes: 9, fondosReservaManual: 0, actualizadoPorId: 7 }, { transaction: { id: "tx" } }],
    ]);
  });

  test.each([-1, "abc", 10000000000, undefined])("rechaza fondos invalidos %s antes de escribir", async (valor) => {
    await expect(guardarNomina({ anio: 2026, mes: 9, registros: [
      { usuarioId: 4, fondosReservaManual: 20 },
      { usuarioId: 5, fondosReservaManual: valor },
    ] }, 7)).rejects.toMatchObject({ statusCode: 400 });
    expect(RolCreditekAjuste.findOrCreate).not.toHaveBeenCalled();
  });

  test("rechaza colaboradores duplicados", async () => {
    await expect(guardarNomina({ anio: 2026, mes: 9, registros: [
      { usuarioId: 4, fondosReservaManual: 20 },
      { usuarioId: 4, fondosReservaManual: 25 },
    ] }, 7)).rejects.toMatchObject({ statusCode: 400 });
    expect(RolCreditekAjuste.findOrCreate).not.toHaveBeenCalled();
  });

  test("recupera el importe guardado incluido cero y mantiene automatico sin ajuste", async () => {
    Usuario.findAll.mockResolvedValue([{ id: 4 }, { id: 5 }, { id: 6 }]);
    EgresoCreditekEntrada.findAll.mockResolvedValue([]);
    ControlFinancieroRegistro.findAll.mockResolvedValue([]);
    ControlFinancieroConciliacionCaja.findAll.mockResolvedValue([]);
    pagosComisionesService.obtenerReportePagosComisiones.mockResolvedValue({ vendedores: [] });
    RolCreditekAjuste.findAll.mockResolvedValue([
      { usuarioId: 4, fondosReservaManual: "25.50", sueldosExtrasManual: "75.50" },
      { usuarioId: 5, fondosReservaManual: "0.00", sueldosExtrasManual: "0.00" },
    ]);
    const resultado = await obtenerResumen({ anio: 2026, mes: 9 });
    expect(resultado.registros.map(r => r.fondosReservaManual)).toEqual([25.5, 0, null]);
    expect(resultado.registros.map(r => r.sueldosExtrasManual)).toEqual([75.5, 0, null]);
    expect(RolCreditekAjuste.findAll).toHaveBeenCalledWith({ where: { anio: 2026, mes: 9 } });
  });
});

describe("sueldos extras de nomina", () => {
  beforeEach(() => jest.clearAllMocks());
  test("guarda sueldo extra y fondos juntos sin sobrescribir otros ajustes", async () => {
    Usuario.count.mockResolvedValue(2);
    const update = jest.fn().mockResolvedValue(undefined);
    RolCreditekAjuste.findOrCreate.mockResolvedValue([{ update }, false]);
    await guardarNomina({ anio: 2026, mes: 9, registros: [
      { usuarioId: 4, fondosReservaManual: 20, sueldosExtrasManual: "75,50", prestamo: 999 },
      { usuarioId: 5, fondosReservaManual: 0, sueldosExtrasManual: 0 },
    ] }, 7);
    expect(update.mock.calls).toEqual([
      [{ usuarioId: 4, anio: 2026, mes: 9, fondosReservaManual: 20, sueldosExtrasManual: 75.5, actualizadoPorId: 7 }, { transaction: { id: "tx" } }],
      [{ usuarioId: 5, anio: 2026, mes: 9, fondosReservaManual: 0, sueldosExtrasManual: 0, actualizadoPorId: 7 }, { transaction: { id: "tx" } }],
    ]);
  });
  test.each([-1, "abc", 10000000000])("rechaza extras invalidos %s sin guardar parcialmente", async (valor) => {
    await expect(guardarNomina({ anio: 2026, mes: 9, registros: [
      { usuarioId: 4, fondosReservaManual: 20, sueldosExtrasManual: 25 },
      { usuarioId: 5, fondosReservaManual: 0, sueldosExtrasManual: valor },
    ] }, 7)).rejects.toMatchObject({ statusCode: 400 });
    expect(RolCreditekAjuste.findOrCreate).not.toHaveBeenCalled();
  });
});
