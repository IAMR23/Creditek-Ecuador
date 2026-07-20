const {
  construirAlertasPersonal,
  obtenerFechaActualEcuador,
  sumarDiasFecha,
} = require("./alertasPersonalService");

describe("alertasPersonalService", () => {
  test("calcula fechas sin depender de la zona horaria del servidor", () => {
    expect(sumarDiasFecha("2026-07-05", 15)).toBe("2026-07-20");
    expect(sumarDiasFecha("2026-01-31", 1)).toBe("2026-02-01");
    expect(
      obtenerFechaActualEcuador(new Date("2026-07-21T03:30:00.000Z")),
    ).toBe("2026-07-20");
  });

  test("genera la alerta cuando una persona activa cumple 15 dias de ingreso", () => {
    const alertas = construirAlertasPersonal(
      [
        {
          id: 10,
          nombre: "Ana Pérez",
          fechaIngreso: "2026-07-05",
          fechaSalida: null,
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

  test("genera la alerta de salida aunque el usuario ya este inactivo", () => {
    const alertas = construirAlertasPersonal(
      [
        {
          id: 20,
          nombre: "Luis Torres",
          fechaIngreso: "2025-01-01",
          fechaSalida: "2026-07-20",
          activo: false,
        },
      ],
      "2026-07-20",
    );

    expect(alertas).toEqual([
      expect.objectContaining({
        tipo: "FECHA_SALIDA",
        usuarioId: 20,
        fechaReferencia: "2026-07-20",
      }),
    ]);
  });

  test("ignora fechas que no corresponden al dia actual", () => {
    const alertas = construirAlertasPersonal(
      [
        {
          id: 30,
          nombre: "Persona sin novedad",
          fechaIngreso: "2026-07-04",
          fechaSalida: "2026-07-21",
          activo: true,
        },
      ],
      "2026-07-20",
    );

    expect(alertas).toHaveLength(0);
  });
});
