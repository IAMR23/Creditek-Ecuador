const {
  construirAlertasPersonal,
  obtenerFechaActualEcuador,
  obtenerRangoDiaEcuador,
  sumarDiasFecha,
} = require("./alertasPersonalService");

describe("alertasPersonalService", () => {
  test("calcula fechas sin depender de la zona horaria del servidor", () => {
    expect(sumarDiasFecha("2026-07-05", 15)).toBe("2026-07-20");
    expect(sumarDiasFecha("2026-01-31", 1)).toBe("2026-02-01");
    expect(
      obtenerFechaActualEcuador(new Date("2026-07-21T03:30:00.000Z")),
    ).toBe("2026-07-20");
    expect(obtenerRangoDiaEcuador("2026-07-20")).toEqual({
      inicio: new Date("2026-07-20T05:00:00.000Z"),
      fin: new Date("2026-07-21T05:00:00.000Z"),
    });
  });

  test("genera la novedad el mismo dia que se crea un usuario", () => {
    const alertas = construirAlertasPersonal(
      [
        {
          id: 5,
          nombre: "Nuevo Usuario",
          createdAt: new Date("2026-07-20T16:30:00.000Z"),
          activo: true,
        },
      ],
      "2026-07-20",
    );

    expect(alertas).toEqual([
      expect.objectContaining({
        tipo: "USUARIO_CREADO",
        usuarioId: 5,
        fechaReferencia: "2026-07-20",
      }),
    ]);
  });

  test("genera la alerta cuando una persona activa cumple 15 dias de ingreso", () => {
    const alertas = construirAlertasPersonal(
      [
        {
          id: 10,
          nombre: "Ana Pérez",
          fechaIngreso: "2026-07-05",
          fechaSalida: null,
          createdAt: new Date("2026-06-01T15:00:00.000Z"),
          activo: true,
        },
      ],
      "2026-07-20",
    );

    expect(alertas).toEqual([
      expect.objectContaining({
        tipo: "INGRESO_15_DIAS",
        usuarioId: 10,
        fechaReferencia: "2026-07-05",
      }),
    ]);
  });

  test("usa la fecha de creacion para los 15 dias si no hay fecha de ingreso", () => {
    const alertas = construirAlertasPersonal(
      [
        {
          id: 15,
          nombre: "Usuario sin fecha de ingreso",
          fechaIngreso: null,
          createdAt: new Date("2026-07-05T15:00:00.000Z"),
          activo: true,
        },
      ],
      "2026-07-20",
    );

    expect(alertas).toEqual([
      expect.objectContaining({
        tipo: "INGRESO_15_DIAS",
        usuarioId: 15,
        fechaReferencia: "2026-07-05",
      }),
    ]);
  });

  test("genera la alerta cuando se registra una fecha de salida", () => {
    const alertas = construirAlertasPersonal(
      [
        {
          id: 20,
          nombre: "Luis Torres",
          fechaIngreso: "2025-01-01",
          fechaSalida: "2026-08-01",
          fechaSalidaRegistradaAt: new Date("2026-07-20T14:00:00.000Z"),
          createdAt: new Date("2025-01-01T15:00:00.000Z"),
          activo: false,
        },
      ],
      "2026-07-20",
    );

    expect(alertas).toEqual([
      expect.objectContaining({
        tipo: "FECHA_SALIDA",
        usuarioId: 20,
        fechaReferencia: "2026-08-01",
      }),
    ]);
  });

  test("no repite la salida en dias posteriores aunque la fecha siga llena", () => {
    const alertas = construirAlertasPersonal(
      [
        {
          id: 30,
          nombre: "Persona sin novedad",
          fechaIngreso: "2026-07-04",
          fechaSalida: "2026-08-01",
          fechaSalidaRegistradaAt: new Date("2026-07-19T14:00:00.000Z"),
          createdAt: new Date("2026-01-01T15:00:00.000Z"),
          activo: true,
        },
      ],
      "2026-07-20",
    );

    expect(alertas).toHaveLength(0);
  });
});
