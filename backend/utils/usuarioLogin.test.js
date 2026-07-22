const {
  crearBaseUsuarioDesdeEmail,
  esUsuarioValido,
  normalizarIdentificador,
} = require("./usuarioLogin");

describe("usuarioLogin", () => {
  test("normaliza correo o usuario para la busqueda", () => {
    expect(normalizarIdentificador("  Juan.Perez@Empresa.COM ")).toBe(
      "juan.perez@empresa.com",
    );
  });

  test("valida el formato permitido para nombres de usuario", () => {
    expect(esUsuarioValido("juan.perez_2")).toBe(true);
    expect(esUsuarioValido("juan perez")).toBe(false);
    expect(esUsuarioValido("jp")).toBe(false);
  });

  test("crea una base de usuario compatible desde el correo", () => {
    expect(crearBaseUsuarioDesdeEmail("Juan+Ventas@Empresa.com")).toBe(
      "juanventas",
    );
  });
});
