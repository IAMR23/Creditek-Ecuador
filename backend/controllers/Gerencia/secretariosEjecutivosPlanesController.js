const service = require("../../services/secretariosEjecutivosPlanesService");

const responderError = (res, error, fallback) => {
  const status = error.statusCode || 500;

  if (status >= 500) {
    console.error(fallback, error);
  }

  return res.status(status).json({
    ok: false,
    message: error.message || fallback,
  });
};

exports.crearPlan = async (req, res) => {
  try {
    const plan = await service.crearPlan({
      user: req.user,
      data: req.body,
    });

    return res.status(201).json({ ok: true, plan });
  } catch (error) {
    return responderError(res, error, "No se pudo crear el plan");
  }
};

exports.listarMisPlanes = async (req, res) => {
  try {
    const planes = await service.listarMisPlanes({
      user: req.user,
      filtros: req.query,
    });

    return res.json({ ok: true, planes });
  } catch (error) {
    return responderError(res, error, "No se pudieron obtener los planes");
  }
};

exports.actualizarPlan = async (req, res) => {
  try {
    const plan = await service.actualizarPlan({
      id: req.params.id,
      user: req.user,
      data: req.body,
    });

    return res.json({ ok: true, plan });
  } catch (error) {
    return responderError(res, error, "No se pudo actualizar el plan");
  }
};

exports.cambiarEstado = async (req, res) => {
  try {
    const plan = await service.cambiarEstado({
      id: req.params.id,
      user: req.user,
      estado: req.body.estado,
    });

    return res.json({ ok: true, plan });
  } catch (error) {
    return responderError(res, error, "No se pudo cambiar el estado");
  }
};
