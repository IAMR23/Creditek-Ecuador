jest.mock("../config/db", () => ({
  sequelize: {
    transaction: jest.fn(async (callback) => callback({ id: "tx" })),
  },
}));
jest.mock("../models/ControlFinancieroCarga", () => ({}));
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
const EgresoCreditekEntrada = require("../models/EgresoCreditekEntrada");
const RolCreditekAjuste = require("../models/RolCreditekAjuste");
const Usuario = require("../models/Usuario");
const pagosComisionesService = require("./pagosComisionesService");
const { guardarAjustes, obtenerResumen } = require("./rolesCreditekResumenService");

describe("rolesCreditekResumenService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Usuario.findAll.mockResolvedValue([]);
    EgresoCreditekEntrada.findAll.mockResolvedValue([]);
    ControlFinancieroRegistro.findAll.mockResolvedValue([]);
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
    ]);
    ControlFinancieroRegistro.findAll.mockResolvedValue([
      { responsablePagoEntradaId: 4, entradas: "5.00" },
    ]);
    RolCreditekAjuste.findAll.mockResolvedValue([
      {
        usuarioId: 4,
        adelantosTransfer: "10.00",
        deudaJimena: "1.00",
        atrasos: "2.00",
        diasNoLaborables: "3.00",
        multasFacturacion: "4.00",
        planmovi: "6.00",
        prestamo: "7.00",
        mecanica: "8.00",
        descuentosMetaManual: null,
        cajaGeneralManual: null,
        entradasManual: null,
        descuentosManual: null,
      },
    ]);
    pagosComisionesService.obtenerReportePagosComisiones.mockResolvedValue({
      vendedores: [{ usuarioId: 4, total: { valorDescontar: 7 } }],
    });

    const resultado = await obtenerResumen({ anio: 2026, mes: 8 });

    expect(resultado.registros).toEqual([
      expect.objectContaining({
        usuarioId: 4,
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
        totalAnticipos: 84,
        planmovi: 6,
        prestamo: 7,
        mecanica: 8,
        sumanPrestamos: 21,
        totalDescuentos: 105,
      }),
    ]);
    expect(resultado.totales.totalAnticipos).toBe(84);
    expect(resultado.totales.sumanPrestamos).toBe(21);
    expect(resultado.totales.totalDescuentos).toBe(105);
    expect(pagosComisionesService.obtenerReportePagosComisiones).toHaveBeenCalledWith({
      year: 2026,
      month: 8,
    });
  });

  test("permite reemplazar valores calculados con ajustes manuales", async () => {
    Usuario.findAll.mockResolvedValue([
      { id: 4, nombre: "Ana Perez", activo: true },
    ]);
    EgresoCreditekEntrada.findAll.mockResolvedValue([
      { usuarioId: 4, seccion: "CAJAS", valor: "20.00" },
      { usuarioId: 4, seccion: "ENTRADAS", valor: "30.00" },
      { usuarioId: 4, seccion: "DESCUENTOS", valor: "2.00" },
    ]);
    ControlFinancieroRegistro.findAll.mockResolvedValue([
      { responsablePagoEntradaId: 4, entradas: "5.00" },
    ]);
    RolCreditekAjuste.findAll.mockResolvedValue([
      {
        usuarioId: 4,
        descuentosMetaManual: "9.00",
        cajaGeneralManual: "44.00",
        entradasManual: null,
        descuentosManual: "0.00",
      },
    ]);
    pagosComisionesService.obtenerReportePagosComisiones.mockResolvedValue({
      vendedores: [{ usuarioId: 4, total: { valorDescontar: 7 } }],
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
        totalAnticipos: 88,
        totalDescuentos: 88,
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
            multasFacturacion: "5.50",
            planmovi: 1,
            prestamo: "2,50",
            mecanica: 3,
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
      multasFacturacion: 5.5,
      planmovi: 1,
      prestamo: 2.5,
      mecanica: 3,
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
