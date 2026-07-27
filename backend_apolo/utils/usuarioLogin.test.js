const assert = require("node:assert/strict");
const { test } = require("node:test");
const { Op } = require("sequelize");

const {
  condicionIdentificadorLogin,
  crearBaseUsuarioDesdeEmail,
  esUsuarioValido,
  normalizarIdentificador,
  normalizarUsuario,
} = require("./usuarioLogin");

test("normaliza correo o usuario para el inicio de sesión", () => {
  assert.equal(
    normalizarIdentificador("  MARIA.PEREZ@EJEMPLO.COM "),
    "maria.perez@ejemplo.com",
  );
  assert.equal(normalizarUsuario("  MARIA_PEREZ "), "maria_perez");
});

test("valida el formato permitido para el nombre de usuario", () => {
  assert.equal(esUsuarioValido("maria.perez-2"), true);
  assert.equal(esUsuarioValido("ab"), false);
  assert.equal(esUsuarioValido("maría pérez"), false);
});

test("genera una base de usuario estable desde el correo", () => {
  assert.equal(
    crearBaseUsuarioDesdeEmail(" MARIA.PEREZ@EJEMPLO.COM "),
    "maria.perez",
  );
  assert.equal(crearBaseUsuarioDesdeEmail("áé@ejemplo.com"), "usuario");
});

test("construye la búsqueda de acceso por email o usuario", () => {
  const condition = condicionIdentificadorLogin("  MARIA.PEREZ ");

  assert.equal(Array.isArray(condition[Op.or]), true);
  assert.equal(condition[Op.or].length, 2);
});
