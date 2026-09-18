const SistemaCapacitacionVideo = require("../models/SistemaCapacitacionVideo");
const { validarVideoCapacitacion } = require("./capacitacionRules");

const crearError = (status, code, message) => {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
};

const normalizarPermiso = (valor) =>
  String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const puedeGestionar = (user = {}) => {
  const permisos = Array.isArray(user.permisos)
    ? user.permisos.map(normalizarPermiso)
    : [];
  return permisos.includes("sistemas") || permisos.includes("administracion");
};

const listar = async ({ user, incluirInactivos = false }) => {
  const mostrarInactivos = Boolean(incluirInactivos) && puedeGestionar(user);
  return SistemaCapacitacionVideo.findAll({
    where: mostrarInactivos ? {} : { activo: true },
    order: [
      ["activo", "DESC"],
      ["createdAt", "DESC"],
      ["id", "DESC"],
    ],
  });
};

const crear = async ({ data, user }) => {
  let valores;
  try {
    valores = validarVideoCapacitacion(data);
  } catch (error) {
    throw crearError(400, "CAPACITACION_VALIDACION", error.message);
  }

  return SistemaCapacitacionVideo.create({
    ...valores,
    activo: data.activo === undefined ? true : valores.activo,
    creadoPorId: user.id,
    actualizadoPorId: user.id,
  });
};

const actualizar = async ({ videoId, data, user }) => {
  const video = await SistemaCapacitacionVideo.findByPk(videoId);
  if (!video) {
    throw crearError(
      404,
      "CAPACITACION_NO_ENCONTRADA",
      "El video de capacitación no existe",
    );
  }

  let valores;
  try {
    valores = validarVideoCapacitacion(data, { parcial: true });
  } catch (error) {
    throw crearError(400, "CAPACITACION_VALIDACION", error.message);
  }

  if (!Object.keys(valores).length) {
    throw crearError(400, "CAPACITACION_SIN_CAMBIOS", "No se enviaron cambios válidos");
  }

  await video.update({ ...valores, actualizadoPorId: user.id });
  return video;
};

module.exports = { actualizar, crear, listar, puedeGestionar };
