const service = require("../../services/uphoneSolicitudesService");
const uphoneLogger = require("../../utils/uphoneLogger");

const responderError = (res, error) =>
  res.status(error.statusCode || 500).json({
    ok: false,
    code: error.code || "UPHONE_ERROR",
    message: error.message || "No se pudo procesar el reporte Uphone",
  });

const ejecutarImportacion = async (req, res, usuarioId) => {
  const startedAt = Date.now();
  const source = usuarioId ? "manual" : "api_key";
  uphoneLogger.info("importacion iniciada", {
    requestId: req.uphoneRequestId,
    source,
    bytes: req.file?.size,
  });
  try {
    const resultado = await service.importarExcel({
      file: req.file,
      usuarioId,
      requestId: req.uphoneRequestId,
    });
    const status = resultado.insertadas > 0 ? 201 : 200;
    const actualizadas = resultado.actualizadas || 0;
    uphoneLogger.info("importacion completada", {
      requestId: req.uphoneRequestId,
      source,
      durationMs: Date.now() - startedAt,
      filasLeidas: resultado.filasLeidas,
      insertadas: resultado.insertadas,
      actualizadas,
      duplicadas: resultado.omitidasDuplicadas,
      invalidas: resultado.omitidasInvalidas,
      vacias: resultado.omitidasVacias,
    });
    return res.status(status).json({
      ok: true,
      message: actualizadas > 0
        ? `${resultado.insertadas} solicitud(es) nueva(s) y ${actualizadas} actualizada(s) con contrato aprobado`
        : resultado.insertadas > 0
          ? `${resultado.insertadas} solicitud(es) nueva(s) importada(s)`
          : "El archivo no contiene solicitudes nuevas",
      resultado,
    });
  } catch (error) {
    uphoneLogger.error("importacion fallida", error, {
      requestId: req.uphoneRequestId,
      source,
      durationMs: Date.now() - startedAt,
      stage: error.uphoneStage || "desconocida",
      chunk: error.uphoneChunk,
    });
    return responderError(res, error);
  }
};

const importarApiKey = (req, res) => ejecutarImportacion(req, res, null);

const importarManual = (req, res) =>
  ejecutarImportacion(req, res, req.user.id);

const listar = async (req, res) => {
  try {
    return res.json(await service.listar(req.query));
  } catch (error) {
    uphoneLogger.error("consulta fallida", error, {
      requestId: req.uphoneRequestId,
    });
    return responderError(res, error);
  }
};

const exportar = async (req, res) => {
  try {
    const resultado = await service.exportarExcel(req.query);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${resultado.filename}"`,
    );
    res.setHeader("X-RVE-Registros", String(resultado.total));
    return res.send(resultado.buffer);
  } catch (error) {
    uphoneLogger.error("exportacion fallida", error, {
      requestId: req.uphoneRequestId,
    });
    return responderError(res, error);
  }
};

const eliminar = async (req, res) => {
  try {
    const solicitud = await service.eliminarSolicitud(req.params.id);
    uphoneLogger.info("solicitud eliminada", {
      requestId: req.uphoneRequestId,
      solicitudId: solicitud.id,
      usuarioId: req.user?.id,
    });
    return res.json({
      ok: true,
      message: `Solicitud #${solicitud.numeroSolicitud} eliminada`,
      solicitud,
    });
  } catch (error) {
    uphoneLogger.error("eliminacion fallida", error, {
      requestId: req.uphoneRequestId,
      solicitudId: req.params.id,
      usuarioId: req.user?.id,
    });
    return responderError(res, error);
  }
};

module.exports = { eliminar, exportar, importarApiKey, importarManual, listar };
