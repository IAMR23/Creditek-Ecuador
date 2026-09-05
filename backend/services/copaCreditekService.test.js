jest.mock("../models/Rol", () => ({ findAll: jest.fn() }));
jest.mock("../models/Usuario", () => ({ findAll: jest.fn(), findOne: jest.fn() }));
jest.mock("../models/UsuarioRol", () => ({ findAll: jest.fn(), findOne: jest.fn() }));
jest.mock("../models/UsuarioAgencia", () => ({ findAll: jest.fn() }));
jest.mock("../models/Agencia", () => ({}));
jest.mock("../models/Marketing/CopaCreditekVendedorConfiguracion", () => ({
  findAll: jest.fn(),
}));
jest.mock("../models/Marketing/CopaCreditekSemanaVendedor", () => ({
  findAll: jest.fn(),
}));
jest.mock("../models/Venta", () => ({ findAll: jest.fn() }));
jest.mock("../models/DetalleVenta", () => ({}));

const {
  construirMarcador,
  obtenerMarcador,
  obtenerVendedoresActivos,
  esVendedorActivo,
  nombreCortoPersona,
  normalizarConfiguracionCompleta,
  normalizarEnteroNoNegativo,
} = require("./copaCreditekService");

const FECHA_INICIO = "2026-09-01";
const FECHA_FIN = "2026-09-07";

const crearMarcador = ({
  usuarios = [{ id: 1, nombre: "Fernando Xavier Simbaña Morales" }],
  agenciasPorUsuario = new Map([
    [1, { id: 10, nombre: "Nueva Aurora" }],
  ]),
  configuraciones = [],
  semanas = [],
  ventasPorUsuario = new Map(),
  ventasDiaPorUsuario = new Map(),
  fechaInicio = FECHA_INICIO,
  fechaFin = FECHA_FIN,
} = {}) =>
  construirMarcador({
    usuarios,
    agenciasPorUsuario,
    configuraciones,
    semanas,
    ventasPorUsuario,
    ventasDiaPorUsuario,
    fechaInicio,
    fechaFin,
  });

describe("Copa Creditek", () => {
  test("incluye con cero al vendedor activo que no tiene ventas", () => {
    const marcador = crearMarcador();
    expect(marcador.vendedores).toHaveLength(1);
    expect(marcador.vendedores[0].ventasCalculadas).toBe(0);
    expect(marcador.vendedores[0].ventasMostradas).toBe(0);
  });

  test("ventasManual null conserva las ventas calculadas", () => {
    const marcador = crearMarcador({
      semanas: [
        {
          usuarioId: 1,
          fechaInicio: FECHA_INICIO,
          fechaFin: FECHA_FIN,
          meta: 13,
          ventasManual: null,
        },
      ],
      ventasPorUsuario: new Map([[1, 5]]),
    });
    expect(marcador.vendedores[0].ventasMostradas).toBe(5);
  });

  test.each([0, 6, 100])("ignora el ajuste antiguo %s y muestra los detalles activos", (ventasManual) => {
    const marcador = crearMarcador({
      semanas: [
        {
          usuarioId: 1,
          fechaInicio: FECHA_INICIO,
          fechaFin: FECHA_FIN,
          meta: 13,
          ventasManual,
        },
      ],
      ventasPorUsuario: new Map([[1, 5]]),
    });
    expect(marcador.vendedores[0]).toMatchObject({
      ventasCalculadas: 5,
      ventasManual: null,
      ventasMostradas: 5,
    });
  });

  test("el total del equipo suma ventasMostradas", () => {
    const marcador = crearMarcador({
      usuarios: [
        { id: 1, nombre: "Fernando Simbaña" },
        { id: 2, nombre: "Ely Martínez" },
      ],
      agenciasPorUsuario: new Map([
        [1, { id: 10, nombre: "Nueva Aurora" }],
        [2, { id: 10, nombre: "nueva aurora" }],
      ]),
      semanas: [
        {
          usuarioId: 2,
          fechaInicio: FECHA_INICIO,
          fechaFin: FECHA_FIN,
          meta: 12,
          ventasManual: 4,
        },
      ],
      ventasPorUsuario: new Map([
        [1, 2],
        [2, 3],
      ]),
    });
    const nuevaAurora = marcador.equipos.find(
      (equipo) => equipo.nombre === "Nueva Aurora",
    );
    expect(nuevaAurora.total).toBe(5);
  });

  test("un vendedor oculto sigue en configuración pero no aparece ni suma", () => {
    const marcador = crearMarcador({
      configuraciones: [
        { usuarioId: 1, mostrarEnMarcador: false },
      ],
      ventasPorUsuario: new Map([[1, 5]]),
      ventasDiaPorUsuario: new Map([[1, 2]]),
    });
    const nuevaAurora = marcador.equipos.find(
      (equipo) => equipo.nombre === "Nueva Aurora",
    );

    expect(marcador.vendedores).toHaveLength(1);
    expect(marcador.vendedores[0].mostrarEnMarcador).toBe(false);
    expect(nuevaAurora.vendedores).toHaveLength(0);
    expect(nuevaAurora.total).toBe(0);
    expect(nuevaAurora.totalDia).toBe(0);
  });

  test("el total del intervalo ignora ajustes antiguos y se distingue del dato diario", () => {
    const marcador = crearMarcador({
      usuarios: [
        { id: 1, nombre: "Fernando Simbaña" },
        { id: 2, nombre: "Ely Martínez" },
      ],
      configuraciones: [{ usuarioId: 2, equipoCopa: "Nueva Aurora" }],
      semanas: [{
        usuarioId: 1,
        fechaInicio: FECHA_INICIO,
        fechaFin: FECHA_FIN,
        meta: 13,
        ventasManual: 20,
      }],
      ventasPorUsuario: new Map([[1, 9], [2, 5]]),
      ventasDiaPorUsuario: new Map([[1, 2], [2, 1]]),
    });
    const equipo = marcador.equipos.find(({ nombre }) => nombre === "Nueva Aurora");
    expect(equipo).toMatchObject({ total: 14, totalDia: 3 });
    expect(equipo.vendedores[0]).toMatchObject({ ventasMostradas: 5 });
    expect(equipo.vendedores[1]).toMatchObject({ ventasMostradas: 9, meta: 13 });
  });

  test("sin ventas de hoy el total diario es cero aunque el intervalo tenga ventas", () => {
    const marcador = crearMarcador({ ventasPorUsuario: new Map([[1, 9]]) });
    expect(marcador.equipos.find(({ nombre }) => nombre === "Nueva Aurora"))
      .toMatchObject({ total: 9, totalDia: 0 });
  });

  test("utiliza la meta configurada para el vendedor", () => {
    const marcador = crearMarcador({
      configuraciones: [{ usuarioId: 1, meta: 14 }],
    });
    expect(marcador.vendedores[0].meta).toBe(14);
  });

  test("conserva la meta configurada aunque cambie el período", () => {
    const marcador = crearMarcador({
      configuraciones: [{ usuarioId: 1, meta: 14 }],
      semanas: [
        {
          usuarioId: 1,
          fechaInicio: FECHA_INICIO,
          fechaFin: FECHA_FIN,
          meta: 7,
          ventasManual: 9,
        },
      ],
      fechaInicio: "2026-09-08",
      fechaFin: "2026-09-14",
    });
    expect(marcador.vendedores[0]).toMatchObject({
      meta: 14,
      ventasManual: null,
    });
  });

  test("el alias tiene prioridad sobre el nombre corto", () => {
    const marcador = crearMarcador({
      configuraciones: [{ usuarioId: 1, alias: "Fer" }],
    });
    expect(marcador.vendedores[0].nombreMostrado).toBe("Fer");
  });

  test("sin alias muestra como máximo un nombre y un apellido", () => {
    expect(nombreCortoPersona("Fernando Xavier Simbaña Morales")).toBe(
      "Fernando Simbaña",
    );
    expect(crearMarcador().vendedores[0].nombreMostrado).toBe(
      "Fernando Simbaña",
    );
  });

  test("un override del período A no se reutiliza en el período B", () => {
    const marcador = crearMarcador({
      semanas: [
        {
          usuarioId: 1,
          fechaInicio: FECHA_INICIO,
          fechaFin: FECHA_FIN,
          meta: 13,
          ventasManual: 9,
        },
      ],
      ventasPorUsuario: new Map([[1, 2]]),
      fechaInicio: "2026-09-08",
      fechaFin: "2026-09-14",
    });
    expect(marcador.vendedores[0]).toMatchObject({
      meta: 0,
      ventasManual: null,
      ventasMostradas: 2,
    });
  });

  test("no acepta una meta negativa", () => {
    expect(normalizarEnteroNoNegativo(-1, "La meta")).toMatchObject({
      valido: false,
    });
  });

  test("no acepta ventasManual negativas ni decimales", () => {
    expect(
      normalizarEnteroNoNegativo(-1, "Las ventas manuales"),
    ).toMatchObject({ valido: false });
    expect(
      normalizarEnteroNoNegativo(1.5, "Las ventas manuales"),
    ).toMatchObject({ valido: false });
    expect(
      normalizarEnteroNoNegativo(null, "Las ventas manuales"),
    ).toMatchObject({ valido: false });
  });

  test("normaliza una fila completa para el guardado masivo", () => {
    expect(
      normalizarConfiguracionCompleta({
        usuarioId: "7",
        alias: " Fer ",
        equipoCopa: "sangolqui",
        mostrarEnMarcador: false,
        meta: "13",
        ventasManual: "",
      }),
    ).toEqual({
      valido: true,
      valor: {
        usuarioId: 7,
        alias: "Fer",
        equipoCopa: "Sangolquí",
        mostrarEnMarcador: false,
        meta: 13,
        ventasManual: null,
      },
    });
  });
});

describe("consulta del marcador diario", () => {
  const { Op } = require("sequelize");
  const Venta = require("../models/Venta");
  const crearVenta = (usuarioId, total, id = 1) => ({
    id,
    usuarioAgencia: { usuarioId },
    detalleVenta: Array.from({ length: total }, (_, i) => ({ id: id * 100 + i })),
  });

  test("no permite introducir ajustes manuales por guardado masivo", () => {
    expect(normalizarConfiguracionCompleta({
      usuarioId: 7, mostrarEnMarcador: true, meta: 13, ventasManual: 99,
    })).toMatchObject({ valido: false });
  });

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    require("../models/Rol").findAll.mockResolvedValue([{ id: 1, nombre: "Vendedor" }]);
    require("../models/UsuarioRol").findAll.mockResolvedValue([]);
    require("../models/Usuario").findAll.mockResolvedValue([{ id: 1, nombre: "Fernando Simbaña" }]);
    require("../models/UsuarioAgencia").findAll.mockResolvedValue([
      { usuarioId: 1, agencia: { id: 10, nombre: "Nueva Aurora" } },
    ]);
    require("../models/Marketing/CopaCreditekVendedorConfiguracion").findAll.mockResolvedValue([]);
    require("../models/Marketing/CopaCreditekSemanaVendedor").findAll.mockResolvedValue([]);
    Venta.findAll.mockResolvedValue([]);
  });

  afterEach(() => jest.useRealTimers());

  test.each([
    ["2026-09-05T04:59:59Z", "2026-09-04"],
    ["2026-09-05T05:00:00Z", "2026-09-05"],
  ])("usa el día de Ecuador en %s aunque el intervalo sea histórico", async (instante, fechaDia) => {
    jest.setSystemTime(new Date(instante));
    Venta.findAll
      .mockResolvedValueOnce([crearVenta(1, 9)])
      .mockResolvedValueOnce([crearVenta(1, 2)]);
    const periodo = { fechaInicio: "2026-08-01", fechaFin: "2026-08-07" };
    const marcador = await obtenerMarcador(periodo);
    expect(Venta.findAll.mock.calls[0][0].where).toEqual({
      activo: true, fecha: { [Op.between]: [periodo.fechaInicio, periodo.fechaFin] },
    });
    expect(Venta.findAll.mock.calls[1][0].where).toEqual({
      activo: true, fecha: { [Op.between]: [fechaDia, fechaDia] },
    });
    expect(marcador).toMatchObject({ ...periodo, fechaDia });
    expect(marcador.equipos.find(({ nombre }) => nombre === "Nueva Aurora"))
      .toMatchObject({ total: 9, totalDia: 2 });
  });

  test("reutiliza la consulta si el intervalo seleccionado es hoy", async () => {
    jest.setSystemTime(new Date("2026-09-04T15:00:00Z"));
    Venta.findAll.mockResolvedValue([crearVenta(1, 2)]);
    const marcador = await obtenerMarcador({ fechaInicio: "2026-09-04", fechaFin: "2026-09-04" });
    expect(Venta.findAll).toHaveBeenCalledTimes(1);
    expect(marcador.equipos.find(({ nombre }) => nombre === "Nueva Aurora"))
      .toMatchObject({ total: 2, totalDia: 2 });
  });

  test("cuenta un punto por detalle único, sin multiplicar cantidad ni sumar entregas", async () => {
    jest.setSystemTime(new Date("2026-09-04T15:00:00Z"));
    Venta.findAll.mockResolvedValue([
      {
        ...crearVenta(1, 2),
        detalleVenta: [{ id: 101, cantidad: 5 }, { id: 102, cantidad: 3 }, { id: 101 }],
        detalleEntregas: [{ id: 999 }],
      },
      crearVenta(1, 1, 2),
      crearVenta(1, 0, 3),
    ]);
    const marcador = await obtenerMarcador({ fechaInicio: "2026-09-04", fechaFin: "2026-09-04" });
    expect(marcador.vendedores[0]).toMatchObject({ ventasCalculadas: 3, ventasDia: 3 });
    const consulta = Venta.findAll.mock.calls[0][0];
    expect(consulta.where.activo).toBe(true);
    expect(consulta.include.map(({ as }) => as)).toEqual(["usuarioAgencia", "detalleVenta"]);
    expect(consulta.include[0].where).toEqual({ usuarioId: { [Op.in]: [1] } });
    // No filtrar activo en usuarioAgencia: una reasignación no borra ventas anteriores.
    expect(consulta.include[0].where).not.toHaveProperty("activo");
  });

  test("incluye a Raúl y separa las ventas de Naomi y Leonel por usuario", async () => {
    require("../models/Usuario").findAll.mockResolvedValue([
      { id: 8, nombre: "Naomi", rolPagoId: 10 },
      { id: 87, nombre: "Leonel", rolPagoId: 20 },
      { id: 11, nombre: "Raúl", rolPagoId: 30 },
    ]);
    require("../models/UsuarioAgencia").findAll.mockResolvedValue(
      [8, 87, 11].map(usuarioId => ({ usuarioId, agencia: { id: 5, nombre: "Martha Bucaram" } })),
    );
    Venta.findAll.mockResolvedValue([crearVenta(8, 2, 1), crearVenta(87, 1, 2)]);
    const marcador = await obtenerMarcador({ fechaInicio: FECHA_INICIO, fechaFin: FECHA_FIN });
    expect(marcador.vendedores.map(v => [v.usuarioId, v.ventasCalculadas])).toEqual([
      [8, 2], [87, 1], [11, 0],
    ]);
    expect(marcador.equipos.find(e => e.nombre === "Martha Bucaram").vendedores).toHaveLength(3);
  });

  test("sin rol Vendedor no consulta ventas", async () => {
    require("../models/Rol").findAll.mockResolvedValue([{ id: 2, nombre: "Administrador" }]);
    const marcador = await obtenerMarcador({ fechaInicio: FECHA_INICIO, fechaFin: FECHA_FIN });
    expect(marcador.vendedores).toEqual([]);
    expect(Venta.findAll).not.toHaveBeenCalled();
  });
});

describe("participación por rol del sistema RVE", () => {
  const { Op } = require("sequelize");
  const Usuario = require("../models/Usuario");
  const UsuarioRol = require("../models/UsuarioRol");

  beforeEach(() => {
    jest.clearAllMocks();
    require("../models/Rol").findAll.mockResolvedValue([{ id: 4, nombre: "Vendedor" }]);
  });

  test("busca rol principal y adicional sin filtrar cargo de pago", async () => {
    UsuarioRol.findAll.mockResolvedValue([{ usuarioId: 11 }]);
    Usuario.findAll.mockResolvedValue([]);
    await obtenerVendedoresActivos();
    expect(Usuario.findAll.mock.calls[0][0].where).toEqual({
      activo: true,
      [Op.or]: [{ rolId: { [Op.in]: [4] } }, { id: { [Op.in]: [11] } }],
    });
  });

  test.each([4, 9])("permite configurar a Raúl con Vendedor principal o adicional (rol principal %s)", async rolId => {
    Usuario.findOne.mockResolvedValue({ id: 11, rolId, rolPagoId: 99 });
    UsuarioRol.findOne.mockResolvedValue({ id: 1 });
    expect(await esVendedorActivo(11)).toBe(true);
    if (rolId === 9) {
      expect(UsuarioRol.findOne.mock.calls[0][0].where).toEqual({
        usuarioId: 11, rolId: { [Op.in]: [4] }, activo: true,
      });
    }
  });

  test("el cargo Vendedor no sustituye al rol del sistema", async () => {
    Usuario.findOne.mockResolvedValue({ id: 11, rolId: 9, rolPagoId: 4 });
    UsuarioRol.findOne.mockResolvedValue(null);
    expect(await esVendedorActivo(11)).toBe(false);
  });
});
