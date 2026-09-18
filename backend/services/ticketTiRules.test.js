const {
  puedeVerTicket,
  formatearCodigoTicket,
  ticketEstaRetrasado,
  tienePermisoGestion,
  validarTransicion,
} = require("./ticketTiRules");

describe("reglas de Tickets de TI", () => {
  test("un usuario normal solo puede ver sus tickets", () => {
    const user = { id: 7, permisos: ["Ventas"] };
    expect(puedeVerTicket(user, { solicitanteId: 7 })).toBe(true);
    expect(puedeVerTicket(user, { solicitanteId: 8 })).toBe(false);
  });

  test("Sistemas y Administración tienen acceso de gestión", () => {
    expect(tienePermisoGestion({ permisos: ["Sistemas"] })).toBe(true);
    expect(tienePermisoGestion({ permisos: ["Administración"] })).toBe(true);
    expect(tienePermisoGestion({ permisos: ["Ventas"] })).toBe(false);
  });

  test("controla el flujo simplificado de cuatro estados", () => {
    expect(
      validarTransicion({
        estadoActual: "Solicitado",
        estadoNuevo: "Pruebas",
        tieneEvidencia: false,
      }),
    ).toMatch(/No se permite/);
    expect(
      validarTransicion({
        estadoActual: "Solicitado",
        estadoNuevo: "Construcción",
        tieneEvidencia: false,
      }),
    ).toBeNull();
  });

  test("producción requiere evidencia de pruebas", () => {
    expect(
      validarTransicion({
        estadoActual: "Pruebas",
        estadoNuevo: "Producción",
        tieneEvidencia: false,
      }),
    ).toMatch(/evidencia/);
    expect(
      validarTransicion({
        estadoActual: "Pruebas",
        estadoNuevo: "Producción",
        tieneEvidencia: true,
      }),
    ).toBeNull();
  });

  test("permite reabrir producción hacia pruebas o construcción", () => {
    expect(
      validarTransicion({
        estadoActual: "Producción",
        estadoNuevo: "Pruebas",
        tieneEvidencia: true,
      }),
    ).toBeNull();
    expect(
      validarTransicion({
        estadoActual: "Producción",
        estadoNuevo: "Construcción",
        tieneEvidencia: true,
      }),
    ).toBeNull();
  });

  test("formatea el consecutivo sin limitar el crecimiento", () => {
    expect(formatearCodigoTicket(1)).toBe("TI-0001");
    expect(formatearCodigoTicket(10000)).toBe("TI-10000");
    expect(() => formatearCodigoTicket(0)).toThrow(/Consecutivo/);
  });

  test("calcula atraso excluyendo los estados terminales", () => {
    expect(
      ticketEstaRetrasado(
        { fechaEstimada: "2026-09-17", estado: "Pruebas" },
        "2026-09-18",
      ),
    ).toBe(true);
    expect(
      ticketEstaRetrasado(
        { fechaEstimada: "2026-09-17", estado: "Producción" },
        "2026-09-18",
      ),
    ).toBe(false);
  });
});
