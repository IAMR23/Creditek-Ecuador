const {
  esEnlaceOneDrive,
  validarVideoCapacitacion,
} = require("./capacitacionRules");

describe("reglas de videos de capacitación", () => {
  test.each([
    "https://1drv.ms/v/s!ejemplo",
    "https://onedrive.live.com/?id=ejemplo",
    "https://empresa.sharepoint.com/:v:/s/capacitacion/ejemplo",
    "https://tenant.microsoftpersonalcontent.com/video.mp4",
  ])("acepta enlaces de OneDrive o SharePoint: %s", (enlace) => {
    expect(esEnlaceOneDrive(enlace)).toBe(true);
  });

  test.each([
    "http://1drv.ms/v/inseguro",
    "https://example.com/video",
    "javascript:alert(1)",
    "",
  ])("rechaza enlaces ajenos o inseguros: %s", (enlace) => {
    expect(esEnlaceOneDrive(enlace)).toBe(false);
  });

  test("normaliza los datos obligatorios", () => {
    expect(
      validarVideoCapacitacion({
        titulo: "  Introducción a ventas  ",
        enlace: " https://1drv.ms/v/demo ",
        descripcion: "  Contenido inicial.  ",
      }),
    ).toEqual({
      titulo: "Introducción a ventas",
      enlace: "https://1drv.ms/v/demo",
      descripcion: "Contenido inicial.",
    });
  });

  test("permite actualizaciones parciales y valida activo", () => {
    expect(
      validarVideoCapacitacion({ activo: false }, { parcial: true }),
    ).toEqual({ activo: false });
    expect(() =>
      validarVideoCapacitacion({ activo: "false" }, { parcial: true }),
    ).toThrow(/verdadero o falso/);
  });
});
