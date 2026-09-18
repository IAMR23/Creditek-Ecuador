const ticketsService = require("../../services/ticketsTiService");

const responderError = (res, error, operacion) => {
  if (error.status) {
    return res.status(error.status).json({
      ok: false,
      code: error.code || "TICKETS_TI_ERROR",
      message: error.message,
    });
  }
  console.error(`Error ${operacion} en Tickets de TI:`, error);
  return res.status(500).json({
    ok: false,
    code: "TICKETS_TI_INTERNAL_ERROR",
    message: "No se pudo completar la operación",
  });
};

exports.listar = async (req, res) => {
  try {
    return res.json({ ok: true, ...(await ticketsService.listar({ query: req.query, user: req.user })) });
  } catch (error) {
    return responderError(res, error, "listando tickets");
  }
};

exports.listarKanban = async (req, res) => {
  try {
    return res.json({
      ok: true,
      ...(await ticketsService.listarKanban({ query: req.query, user: req.user })),
    });
  } catch (error) {
    return responderError(res, error, "listando el tablero");
  }
};

exports.dashboard = async (req, res) => {
  try {
    return res.json({ ok: true, ...(await ticketsService.obtenerDashboard({ user: req.user })) });
  } catch (error) {
    return responderError(res, error, "obteniendo indicadores");
  }
};

exports.crear = async (req, res) => {
  try {
    const ticket = await ticketsService.crear({
      data: req.body,
      files: req.files || [],
      user: req.user,
    });
    return res.status(201).json({ ok: true, ticket });
  } catch (error) {
    return responderError(res, error, "creando un ticket");
  }
};

exports.detalle = async (req, res) => {
  try {
    return res.json({
      ok: true,
      ...(await ticketsService.obtenerDetalle({ ticketId: req.params.id, user: req.user })),
    });
  } catch (error) {
    return responderError(res, error, "consultando un ticket");
  }
};

exports.actualizar = async (req, res) => {
  try {
    return res.json({
      ok: true,
      ...(await ticketsService.actualizar({
        ticketId: req.params.id,
        data: req.body,
        user: req.user,
      })),
    });
  } catch (error) {
    return responderError(res, error, "actualizando un ticket");
  }
};

exports.comentar = async (req, res) => {
  try {
    return res.status(201).json({
      ok: true,
      ...(await ticketsService.agregarComentario({
        ticketId: req.params.id,
        data: req.body,
        user: req.user,
      })),
    });
  } catch (error) {
    return responderError(res, error, "agregando un comentario");
  }
};

exports.adjuntar = async (req, res) => {
  try {
    return res.status(201).json({
      ok: true,
      ...(await ticketsService.agregarArchivos({
        ticketId: req.params.id,
        files: req.files || [],
        user: req.user,
      })),
    });
  } catch (error) {
    return responderError(res, error, "adjuntando archivos");
  }
};

exports.descargar = async (req, res) => {
  try {
    const archivo = await ticketsService.obtenerArchivoDescarga({
      ticketId: req.params.id,
      archivoId: req.params.archivoId,
      user: req.user,
    });
    res.type(archivo.mimeType);
    return res.download(archivo.ruta, archivo.nombre);
  } catch (error) {
    return responderError(res, error, "descargando un archivo");
  }
};

exports.responsables = async (req, res) => {
  try {
    const responsables = await ticketsService.listarResponsables({ user: req.user });
    return res.json({
      ok: true,
      responsables,
    });
  } catch (error) {
    return responderError(res, error, "consultando responsables");
  }
};
