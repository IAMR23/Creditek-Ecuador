const service = require("../../services/consejoEjecutivoPlanesService");
const salasService = require("../../services/consejoEjecutivoSalasService");

const responderError = (res, error, fallback) => {
  const status = error.statusCode || 500;
  if (status >= 500) console.error(fallback, error);

  return res.status(status).json({
    ok: false,
    message: error.message || fallback,
  });
};

const emitirActualizacion = async (req, accion, plan) => {
  const io = req.app.get("io");
  if (!io) return;

  try {
    const destinatarioIds = await salasService.obtenerDestinatarioIds(plan.salaId);
    const rooms = destinatarioIds.map((id) => `user_${id}`);
    if (rooms.length) {
      io.to(rooms).emit("consejo-ejecutivo:actualizado", { accion, plan });
    }
  } catch (error) {
    console.error("No se pudo emitir la actualizacion del Consejo Ejecutivo", error);
  }
};

exports.listarPlanes = async (req, res) => {
  try {
    const planes = await service.listarPlanes({
      user: req.user,
      filtros: req.query,
    });
    return res.json({ ok: true, planes });
  } catch (error) {
    return responderError(res, error, "No se pudieron obtener los planes");
  }
};

exports.listarResponsables = async (_req, res) => {
  try {
    const responsables = await service.listarResponsables();
    return res.json({ ok: true, responsables });
  } catch (error) {
    return responderError(res, error, "No se pudieron obtener los responsables");
  }
};

exports.crearPlan = async (req, res) => {
  try {
    const plan = await service.crearPlan({ user: req.user, data: req.body });
    await emitirActualizacion(req, "creado", plan);
    return res.status(201).json({ ok: true, plan });
  } catch (error) {
    return responderError(res, error, "No se pudo crear el plan");
  }
};

exports.actualizarPlan = async (req, res) => {
  try {
    const plan = await service.actualizarPlan({
      id: req.params.id,
      user: req.user,
      data: req.body,
    });
    await emitirActualizacion(req, "actualizado", plan);
    return res.json({ ok: true, plan });
  } catch (error) {
    return responderError(res, error, "No se pudo actualizar el plan");
  }
};
