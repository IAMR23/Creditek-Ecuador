const {
  esEnlaceOneDrive,
  esEnlaceVideoPermitido,
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
    "https://drive.google.com/file/d/1AbC_def-123/view?usp=sharing",
    "https://drive.google.com/open?id=1AbC_def-123",
    "https://docs.google.com/file/d/1AbC_def-123/view",
  ])("acepta enlaces de archivo de Google Drive: %s", (enlace) => {
    expect(esEnlaceVideoPermitido(enlace)).toBe(true);
  });

  test.each([
    "http://1drv.ms/v/inseguro",
    "https://example.com/video",
    "https://drive.google.com/drive/folders/1AbC_def-123",
    "https://falso-drive.google.com/file/d/1AbC_def-123/view",
    "javascript:alert(1)",
    "",
  ])("rechaza enlaces ajenos o inseguros: %s", (enlace) => {
    expect(esEnlaceOneDrive(enlace)).toBe(false);
  });

  test("normaliza los datos obligatorios", () => {
    expect(
      validarVideoCapacitacion({
        titulo: "  Introducción a ventas  ",
        enlace: " https://drive.google.com/file/d/1AbC_def-123/view ",
        descripcion: "  Contenido inicial.  ",
      }),
    ).toEqual({
      titulo: "Introducción a ventas",
      enlace: "https://drive.google.com/file/d/1AbC_def-123/view",
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
