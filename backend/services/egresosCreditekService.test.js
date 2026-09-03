jest.mock("../models/EgresoCreditekEntrada", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
  findOne: jest.fn(),
}));
jest.mock("../models/ControlFinancieroCarga", () => ({}));
jest.mock("../models/ControlFinancieroConciliacionCaja", () => ({
  findAll: jest.fn(),
}));
jest.mock("../models/ControlFinancieroRegistro", () => ({
  findAll: jest.fn(),
}));
jest.mock("../models/Usuario", () => ({
  findAll: jest.fn(),
  findOne: jest.fn(),
}));

const EgresoCreditekEntrada = require("../models/EgresoCreditekEntrada");
const ControlFinancieroConciliacionCaja = require(
  "../models/ControlFinancieroConciliacionCaja",
);
const ControlFinancieroRegistro = require("../models/ControlFinancieroRegistro");
const Usuario = require("../models/Usuario");
const { Op } = require("sequelize");
const {
  actualizarRegistro,
  cambiarEstadoRegistro,
  crearEntrada,
  crearRegistro,
  eliminarRegistro,
  obtenerEntradas,
  obtenerRegistros,
} = require("./egresosCreditekService");

describe("egresosCreditekService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ControlFinancieroRegistro.findAll.mockResolvedValue([]);
    ControlFinancieroConciliacionCaja.findAll.mockResolvedValue([]);
  });

  test("lista usuarios activos, entradas y suma total", async () => {
    Usuario.findAll.mockResolvedValue([{ id: 1, nombre: "Ana" }]);
    EgresoCreditekEntrada.findAll.mockResolvedValue([
      { id: 8, usuarioId: 1, valor: "42.09", createdAt: "2026-08-11" },
      { id: 9, usuarioId: 1, valor: "20.00", createdAt: "2026-08-11" },
    ]);

    const resultado = await obtenerEntradas();

    expect(Usuario.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ where: { activo: true } }),
    );
    expect(resultado).toEqual({
      usuarios: [{ id: 1, nombre: "Ana" }],
      entradas: expect.arrayContaining([
        expect.objectContaining({ id: 8, valor: 42.09 }),
        expect.objectContaining({ id: 9, valor: 20 }),
      ]),
      total: 62.09,
    });
  });

  test("lista entradas manuales sin consultar control financiero", async () => {
    Usuario.findAll.mockResolvedValue([{ id: 2, nombre: "Ana" }]);
    EgresoCreditekEntrada.findAll.mockResolvedValue([
      { id: 8, usuarioId: 2, valor: "10.00", createdAt: "2026-08-10" },
    ]);

    const resultado = await obtenerRegistros("entradas");

    expect(ControlFinancieroRegistro.findAll).not.toHaveBeenCalled();
    expect(resultado.registros).toEqual([
      expect.objectContaining({ id: 8, origen: "MANUAL", valor: 10 }),
    ]);
    expect(resultado.total).toBe(10);
  });

  test("crea una entrada para un usuario activo", async () => {
    Usuario.findOne.mockResolvedValue({ id: 3 });
    EgresoCreditekEntrada.create.mockResolvedValue({ id: 12 });
    EgresoCreditekEntrada.findByPk.mockResolvedValue({
      id: 12,
      usuarioId: 3,
      valor: "38.71",
      observacion: "Adelanto de caja",
      registradoPorId: 7,
      usuario: { id: 3, nombre: "Edison", activo: true },
      registradoPor: { id: 7, nombre: "Contabilidad" },
    });

    const resultado = await crearEntrada(
      {
        usuarioId: 3,
        valor: "38,71",
        observacion: " Adelanto de caja ",
        fecha: "2026-08-15",
      },
      7,
    );

    expect(Usuario.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 3, activo: true } }),
    );
    expect(EgresoCreditekEntrada.create).toHaveBeenCalledWith({
      usuarioId: 3,
      valor: 38.71,
      observacion: "Adelanto de caja",
      fecha: "2026-08-15",
      seccion: "ENTRADAS",
      registradoPorId: 7,
    });
    expect(resultado).toEqual(
      expect.objectContaining({ id: 12, valor: 38.71 }),
    );
  });

  test("rechaza valores en cero o negativos", async () => {
    await expect(
      crearEntrada({ usuarioId: 3, valor: "0" }, 7),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(Usuario.findOne).not.toHaveBeenCalled();
    expect(EgresoCreditekEntrada.create).not.toHaveBeenCalled();
  });

  test("exige fecha de sancion en todos los rubros", async () => {
    await expect(
      crearRegistro("otros", { usuarioId: 3, valor: "10" }, 7),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining("fecha"),
    });
    expect(EgresoCreditekEntrada.create).not.toHaveBeenCalled();
  });

  test("rechaza usuarios inactivos", async () => {
    Usuario.findOne.mockResolvedValue(null);

    await expect(
      crearEntrada({ usuarioId: 3, valor: "10", fecha: "2026-08-11" }, 7),
    ).rejects.toMatchObject({
      statusCode: 400,
      message: expect.stringContaining("inactivo"),
    });
    expect(EgresoCreditekEntrada.create).not.toHaveBeenCalled();
  });

  test("rechaza observaciones demasiado extensas", async () => {
    await expect(
      crearEntrada(
        { usuarioId: 3, valor: "10", observacion: "a".repeat(1001) },
        7,
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(Usuario.findOne).not.toHaveBeenCalled();
  });

  test("lista solamente los registros de la seccion solicitada", async () => {
    Usuario.findAll.mockResolvedValue([{ id: 2, nombre: "Raul" }]);
    EgresoCreditekEntrada.findAll.mockResolvedValue([
      { id: 20, seccion: "CAJAS", valor: "25.50" },
    ]);

    const resultado = await obtenerRegistros("cajas");

    expect(EgresoCreditekEntrada.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ where: { seccion: "CAJAS" } }),
    );
    expect(ControlFinancieroRegistro.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tipoRegistro: "CAJA",
          pagosCuotas: { [Op.gt]: 0 },
          responsablePagoEntradaId: { [Op.ne]: null },
        }),
      }),
    );
    expect(resultado).toEqual(
      expect.objectContaining({
        seccion: "CAJAS",
        registros: [expect.objectContaining({ id: 20, valor: 25.5 })],
        total: 25.5,
      }),
    );
  });

  test("incluye cajas no en cierre vinculadas de control financiero", async () => {
    Usuario.findAll.mockResolvedValue([{ id: 2, nombre: "Ana" }]);
    EgresoCreditekEntrada.findAll.mockResolvedValue([]);
    ControlFinancieroRegistro.findAll.mockResolvedValue([
      {
        toJSON: () => ({
          id: 77,
          cargaId: 9,
          tipoRegistro: "CAJA",
          contrato: "C-77",
          cliente: "Cliente Caja",
          usuarioCobrador: "Cobrador",
          pagosCuotas: "14.00",
          responsablePagoEntradaId: 2,
          observacionPagoEntrada: "No consta en cierre",
          responsablePagoEntrada: { id: 2, nombre: "Ana", activo: true },
          carga: {
            id: 9,
            fechaReporte: "2026-08-26",
            estado: "ACTIVA",
            usuario: { id: 7, nombre: "Contabilidad" },
          },
          createdAt: "2026-08-26T10:00:00.000Z",
          updatedAt: "2026-08-26T11:00:00.000Z",
        }),
      },
    ]);
    ControlFinancieroConciliacionCaja.findAll.mockResolvedValue([
      {
        toJSON: () => ({
          id: 15,
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

    const resultado = await obtenerRegistros("cajas");

    expect(resultado.registros).toEqual([
      expect.objectContaining({
        id: "control-financiero-caja-77",
        origen: "CONTROL_FINANCIERO_CAJA",
        usuarioId: 2,
        valor: 14,
        observacion: "No consta en cierre",
        seccion: "CAJAS",
      }),
    ]);
    expect(resultado.total).toBe(14);
  });

  test("guarda transferencias en su propia seccion", async () => {
    Usuario.findOne.mockResolvedValue({ id: 3 });
    EgresoCreditekEntrada.create.mockResolvedValue({ id: 21 });
    EgresoCreditekEntrada.findByPk.mockResolvedValue({
      id: 21,
      usuarioId: 3,
      valor: "10.00",
      seccion: "TRANSFERENCIAS",
      registradoPorId: 7,
    });

    await crearRegistro(
      "transferencias",
      { usuarioId: 3, valor: "10", fecha: "2026-08-20" },
      7,
    );

    expect(EgresoCreditekEntrada.create).toHaveBeenCalledWith({
      usuarioId: 3,
      valor: 10,
      observacion: null,
      fecha: "2026-08-20",
      seccion: "TRANSFERENCIAS",
      registradoPorId: 7,
    });
  });

  test("rechaza secciones desconocidas antes de consultar la base", async () => {
    await expect(obtenerRegistros("desconocida")).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(Usuario.findAll).not.toHaveBeenCalled();
    expect(EgresoCreditekEntrada.findAll).not.toHaveBeenCalled();
  });

  test("excluye registros inactivos del total sin ocultarlos", async () => {
    Usuario.findAll.mockResolvedValue([]);
    EgresoCreditekEntrada.findAll.mockResolvedValue([
      { id: 30, valor: "40.00", activo: true },
      { id: 31, valor: "15.00", activo: false },
    ]);

    const resultado = await obtenerRegistros("descuentos");

    expect(resultado.registros).toHaveLength(2);
    expect(resultado.total).toBe(40);
  });

  test("edita un registro y guarda quien realizo el cambio", async () => {
    const registro = {
      id: 32,
      usuarioId: 3,
      update: jest.fn().mockResolvedValue(undefined),
    };
    EgresoCreditekEntrada.findOne.mockResolvedValue(registro);
    EgresoCreditekEntrada.findByPk.mockResolvedValue({
      id: 32,
      usuarioId: 3,
      valor: "22.50",
      ultimaAccion: "EDITADO",
      actualizadoPorId: 7,
    });

    const resultado = await actualizarRegistro(
      "cajas",
      32,
      {
        usuarioId: 3,
        valor: "22,50",
        observacion: " Ajuste ",
        fecha: "2026-08-21",
      },
      7,
    );

    expect(EgresoCreditekEntrada.findOne).toHaveBeenCalledWith({
      where: { id: 32, seccion: "CAJAS" },
    });
    expect(registro.update).toHaveBeenCalledWith({
      usuarioId: 3,
      valor: 22.5,
      observacion: "Ajuste",
      fecha: "2026-08-21",
      actualizadoPorId: 7,
      ultimaAccion: "EDITADO",
    });
    expect(resultado).toEqual(
      expect.objectContaining({ id: 32, ultimaAccion: "EDITADO" }),
    );
    expect(Usuario.findOne).not.toHaveBeenCalled();
  });

  test("exige un usuario activo al reasignar un registro", async () => {
    EgresoCreditekEntrada.findOne.mockResolvedValue({
      id: 33,
      usuarioId: 3,
      update: jest.fn(),
    });
    Usuario.findOne.mockResolvedValue(null);

    await expect(
      actualizarRegistro(
        "transferencias",
        33,
        {
          usuarioId: 4,
          valor: "10",
          observacion: "",
          fecha: "2026-08-22",
        },
        7,
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  test("desactiva y audita el cambio de estado", async () => {
    const registro = {
      id: 34,
      update: jest.fn().mockResolvedValue(undefined),
    };
    EgresoCreditekEntrada.findOne.mockResolvedValue(registro);
    EgresoCreditekEntrada.findByPk.mockResolvedValue({
      id: 34,
      valor: "12.00",
      activo: false,
      ultimaAccion: "DESACTIVADO",
      actualizadoPorId: 9,
    });

    const resultado = await cambiarEstadoRegistro(
      "entradas",
      34,
      false,
      9,
    );

    expect(registro.update).toHaveBeenCalledWith({
      activo: false,
      actualizadoPorId: 9,
      ultimaAccion: "DESACTIVADO",
    });
    expect(resultado).toEqual(
      expect.objectContaining({ activo: false, ultimaAccion: "DESACTIVADO" }),
    );
  });

  test("elimina definitivamente un registro manual de la seccion solicitada", async () => {
    const registro = {
      id: 36,
      destroy: jest.fn().mockResolvedValue(undefined),
    };
    EgresoCreditekEntrada.findOne.mockResolvedValue(registro);

    const resultado = await eliminarRegistro("entradas", 36);

    expect(EgresoCreditekEntrada.findOne).toHaveBeenCalledWith({
      where: { id: 36, seccion: "ENTRADAS" },
    });
    expect(registro.destroy).toHaveBeenCalledTimes(1);
    expect(resultado).toEqual({ id: 36 });
  });

  test("rechaza un estado que no sea booleano", async () => {
    EgresoCreditekEntrada.findOne.mockResolvedValue({ id: 35 });

    await expect(
      cambiarEstadoRegistro("entradas", 35, "false", 9),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});
