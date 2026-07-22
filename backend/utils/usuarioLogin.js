const { Op, col, fn, where } = require("sequelize");

const USUARIO_REGEX = /^[a-z0-9._-]{3,50}$/;

const normalizarIdentificador = (valor) =>
  String(valor || "")
    .trim()
    .toLowerCase();

const normalizarUsuario = (valor) => normalizarIdentificador(valor);

const esUsuarioValido = (valor) => USUARIO_REGEX.test(normalizarUsuario(valor));

const crearBaseUsuarioDesdeEmail = (email) => {
  const parteLocal = normalizarIdentificador(email).split("@")[0] || "";
  const base = parteLocal.replace(/[^a-z0-9._-]/g, "").slice(0, 42);

  return base.length >= 3 ? base : "usuario";
};

const condicionCampoNormalizado = (campo, valor) =>
  where(fn("LOWER", col(campo)), { [Op.eq]: normalizarIdentificador(valor) });

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
