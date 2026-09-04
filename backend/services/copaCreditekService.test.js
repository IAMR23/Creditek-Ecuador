const {
  construirMarcador,
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
  fechaInicio = FECHA_INICIO,
  fechaFin = FECHA_FIN,
} = {}) =>
  construirMarcador({
    usuarios,
    agenciasPorUsuario,
    configuraciones,
    semanas,
    ventasPorUsuario,
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

  test("ventasManual reemplaza únicamente el valor mostrado", () => {
    const marcador = crearMarcador({
      semanas: [
        {
          usuarioId: 1,
          fechaInicio: FECHA_INICIO,
          fechaFin: FECHA_FIN,
          meta: 13,
          ventasManual: 6,
        },
      ],
      ventasPorUsuario: new Map([[1, 5]]),
    });
    expect(marcador.vendedores[0]).toMatchObject({
      ventasCalculadas: 5,
      ventasManual: 6,
      ventasMostradas: 6,
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
    expect(nuevaAurora.total).toBe(6);
  });

  test("un vendedor oculto sigue en configuración pero no aparece ni suma", () => {
    const marcador = crearMarcador({
      configuraciones: [
        { usuarioId: 1, mostrarEnMarcador: false },
      ],
      ventasPorUsuario: new Map([[1, 5]]),
    });
    const nuevaAurora = marcador.equipos.find(
      (equipo) => equipo.nombre === "Nueva Aurora",
    );

    expect(marcador.vendedores).toHaveLength(1);
    expect(marcador.vendedores[0].mostrarEnMarcador).toBe(false);
    expect(nuevaAurora.vendedores).toHaveLength(0);
    expect(nuevaAurora.total).toBe(0);
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
