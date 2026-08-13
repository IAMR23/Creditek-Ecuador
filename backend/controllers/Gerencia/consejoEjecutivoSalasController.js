const service = require("../../services/consejoEjecutivoSalasService");

const responderError = (res, error, fallback) => {
  const status = error.statusCode || 500;
  if (status >= 500) console.error(fallback, error);

  return res.status(status).json({
    ok: false,
    message: error.message || fallback,
  });
};

const emitirActualizacion = async (
  req,
  accion,
  sala,
  destinatarioIdsAdicionales = [],
) => {
  const io = req.app.get("io");
  if (!io) return;

  try {
    const destinatarioIds = [
      ...new Set([
        ...(await service.obtenerDestinatarioIds(sala.id)),
        ...destinatarioIdsAdicionales,
      ].map(Number)),
    ];
    const rooms = destinatarioIds.map((id) => `user_${id}`);
    if (rooms.length) {
      io.to(rooms).emit("consejo-ejecutivo:salas-actualizadas", {
        accion,
        sala,
      });
    }
  } catch (error) {
    console.error("No se pudo emitir la actualizacion de la sala", error);
  }
};

exports.listarSalas = async (req, res) => {
  try {
    const salas = await service.listarSalas({ user: req.user });
    return res.json({ ok: true, salas });
  } catch (error) {
    return responderError(res, error, "No se pudieron obtener las salas");
  }
};

exports.crearSala = async (req, res) => {
  try {
    const sala = await service.crearSala({ user: req.user, data: req.body });
    await emitirActualizacion(req, "creada", sala);
    return res.status(201).json({ ok: true, sala });
  } catch (error) {
    return responderError(res, error, "No se pudo crear la sala");
  }
};

exports.actualizarSala = async (req, res) => {
  try {
    const destinatariosAnteriores = await service.obtenerDestinatarioIds(
      req.params.id,
    );
    const sala = await service.actualizarSala({
      id: req.params.id,
      user: req.user,
      data: req.body,
    });
    await emitirActualizacion(
      req,
      "actualizada",
      sala,
      destinatariosAnteriores,
    );
    return res.json({ ok: true, sala });
  } catch (error) {
    return responderError(res, error, "No se pudo actualizar la sala");
  }
};
