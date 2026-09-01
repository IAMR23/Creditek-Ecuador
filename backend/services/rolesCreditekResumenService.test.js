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

const ControlFinancieroRegistro = require("../models/ControlFinancieroRegistro");
const ControlFinancieroConciliacionCaja = require(
  "../models/ControlFinancieroConciliacionCaja",
);
const EgresoCreditekEntrada = require("../models/EgresoCreditekEntrada");
const RolCreditekAjuste = require("../models/RolCreditekAjuste");
const Usuario = require("../models/Usuario");
const pagosComisionesService = require("./pagosComisionesService");
const { Op } = require("sequelize");
const { guardarAjustes, obtenerResumen } = require("./rolesCreditekResumenService");

describe("rolesCreditekResumenService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Usuario.findAll.mockResolvedValue([]);
    EgresoCreditekEntrada.findAll.mockResolvedValue([]);
    ControlFinancieroRegistro.findAll.mockResolvedValue([]);
    ControlFinancieroConciliacionCaja.findAll.mockResolvedValue([]);
    RolCreditekAjuste.findAll.mockResolvedValue([]);
    pagosComisionesService.obtenerReportePagosComisiones.mockResolvedValue({
      vendedores: [],
    });
  });

  test("consolida valores automaticos, manuales y total por colaborador", async () => {
    Usuario.findAll.mockResolvedValue([
      { id: 4, nombre: "Ana Perez", activo: true },
    ]);
    EgresoCreditekEntrada.findAll.mockResolvedValue([
      { usuarioId: 4, seccion: "TRANSFERENCIAS", valor: "999.00" },
      { usuarioId: 4, seccion: "CAJAS", valor: "20.00" },
      { usuarioId: 4, seccion: "ENTRADAS", valor: "30.00" },
      { usuarioId: 4, seccion: "DESCUENTOS", valor: "2.00" },
      { usuarioId: 4, seccion: "MULTAS_FACTURACION", valor: "4.00" },
    ]);
    ControlFinancieroRegistro.findAll
      .mockResolvedValueOnce([{ responsablePagoEntradaId: 4, entradas: "5.00" }])
      .mockResolvedValueOnce([]);
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

    expect(resultado.registros).toEqual([
      expect.objectContaining({
        usuarioId: 4,
        ingresosComisiones: 123.45,
        adelantosTransfer: 10,
        descuentosMeta: 7,
        descuentosMetaCalculado: 7,
        descuentosMetaManual: null,
        cajaGeneral: 20,
        cajaGeneralCalculado: 20,
        cajaGeneralManual: null,
        entradas: 35,
        entradasCalculado: 35,
        entradasManual: null,
        descuentos: 2,
        descuentosCalculado: 2,
        descuentosManual: null,
        deudaJimena: 1,
        atrasos: 2,
        diasNoLaborables: 3,
        multasFacturacion: 4,
        multasFacturacionCalculado: 4,
        multasFacturacionManual: null,
        totalAnticipos: 84,
        planmovi: 6,
        prestamo: 7,
        mecanica: 8,
        pagosLentes: 9,
        sueldo: 50,
        sumanPrestamos: 30,
        totalDescuentos: 114,
        totalNomina: 9.45,
        totalPagarNomina: 59.45,
      }),
    ]);
    expect(resultado.totales.totalAnticipos).toBe(84);
    expect(resultado.totales.ingresosComisiones).toBe(123.45);
    expect(resultado.totales.sumanPrestamos).toBe(30);
    expect(resultado.totales.totalDescuentos).toBe(114);
    expect(resultado.totales.totalNomina).toBe(9.45);
    expect(resultado.totales.totalPagarNomina).toBe(59.45);
    expect(resultado.totales.sueldo).toBe(50);
    expect(pagosComisionesService.obtenerReportePagosComisiones).toHaveBeenCalledWith({
      year: 2026,
      month: 8,
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
      { usuarioId: 4, seccion: "CAJAS", valor: "20.00" },
      { usuarioId: 4, seccion: "ENTRADAS", valor: "30.00" },
      { usuarioId: 4, seccion: "DESCUENTOS", valor: "2.00" },
      { usuarioId: 4, seccion: "MULTAS_FACTURACION", valor: "4.00" },
    ]);
    ControlFinancieroRegistro.findAll
      .mockResolvedValueOnce([{ responsablePagoEntradaId: 4, entradas: "5.00" }])
      .mockResolvedValueOnce([]);
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
        entradas: 35,
        entradasCalculado: 35,
        entradasManual: null,
        descuentos: 0,
        descuentosCalculado: 2,
        descuentosManual: 0,
        multasFacturacion: 6,
        multasFacturacionCalculado: 4,
        multasFacturacionManual: 6,
        totalAnticipos: 94,
        totalDescuentos: 94,
      }),
    ]);
  });

  test("suma cajas no en cierre de control financiero al responsable", async () => {
    Usuario.findAll.mockResolvedValue([
      { id: 4, nombre: "Ana Perez", activo: true },
    ]);
    ControlFinancieroRegistro.findAll
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
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

    expect(ControlFinancieroRegistro.findAll.mock.calls[1][0]).toEqual(
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
            descuentosManual: "4,25",
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
      descuentosManual: 4.25,
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
