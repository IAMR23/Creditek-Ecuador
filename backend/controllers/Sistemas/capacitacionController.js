const capacitacionService = require("../../services/capacitacionService");

const responderError = (res, error, operacion) => {
  if (error.status) {
    return res.status(error.status).json({
      ok: false,
      code: error.code || "CAPACITACION_ERROR",
      message: error.message,
    });
  }

  console.error(`Error ${operacion} capacitación:`, error);
  return res.status(500).json({
    ok: false,
    code: "CAPACITACION_INTERNAL_ERROR",
    message: "No se pudo completar la operación",
  });
};

exports.listar = async (req, res) => {
  try {
    const videos = await capacitacionService.listar({
      user: req.user,
      incluirInactivos: req.query.incluirInactivos === "true",
    });
    return res.json({ ok: true, videos });
  } catch (error) {
    return responderError(res, error, "listando videos de");
  }
};

exports.crear = async (req, res) => {
  try {
    const video = await capacitacionService.crear({
      data: req.body,
      user: req.user,
    });
    return res.status(201).json({ ok: true, video });
  } catch (error) {
    return responderError(res, error, "creando video de");
  }
};

exports.actualizar = async (req, res) => {
  try {
    const video = await capacitacionService.actualizar({
      videoId: req.params.id,
      data: req.body,
      user: req.user,
    });
    return res.json({ ok: true, video });
  } catch (error) {
    return responderError(res, error, "actualizando video de");
  }
};
