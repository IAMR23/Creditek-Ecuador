const { Op, col, fn, where } = require("sequelize");

const USUARIO_REGEX = /^[a-z0-9._-]{3,50}$/;

const normalizarIdentificador = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

const normalizarUsuario = (value) => normalizarIdentificador(value);

const esUsuarioValido = (value) =>
  USUARIO_REGEX.test(normalizarUsuario(value));

const crearBaseUsuarioDesdeEmail = (email) => {
  const localPart = normalizarIdentificador(email).split("@")[0] || "";
  const base = localPart.replace(/[^a-z0-9._-]/g, "").slice(0, 42);

  return base.length >= 3 ? base : "usuario";
};

const condicionCampoNormalizado = (field, value) =>
  where(fn("LOWER", fn("BTRIM", col(field))), {
    [Op.eq]: normalizarIdentificador(value),
  });

const condicionIdentificadorLogin = (identificador) => ({
  [Op.or]: [
    condicionCampoNormalizado("email", identificador),
    condicionCampoNormalizado("usuario", identificador),
  ],
});

module.exports = {
  USUARIO_REGEX,
  condicionCampoNormalizado,
  condicionIdentificadorLogin,
  crearBaseUsuarioDesdeEmail,
  esUsuarioValido,
  normalizarIdentificador,
  normalizarUsuario,
};
