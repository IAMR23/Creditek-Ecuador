const service = require("../../services/mastherPhoneInventarioService");

const sendError = (res, error) => {
  const status = error.httpStatus || 500;
  if (status >= 500) {
    console.error("Error en inventario Masther Phone:", {
      code: error.code || "MASTHER_PHONE_INTERNAL_ERROR",
      message: error.message,
    });
  }
  return res.status(status).json({
    ok: false,
    code: error.code || "MASTHER_PHONE_INTERNAL_ERROR",
    message:
      status >= 500 && !error.httpStatus
        ? "No fue posible procesar el inventario de Masther Phone."
        : error.message,
  });
};

const catalogos = async (_req, res) => {
  try {
    return res.json({ ok: true, ...(await service.getCatalog()) });
  } catch (error) {
    return sendError(res, error);
  }
};

const registrarIngreso = async (req, res) => {
  try {
    const result = await service.registerEntry(req.body, req.user?.id);
    return res.status(result.duplicado ? 200 : 201).json({ ok: true, ...result });
  } catch (error) {
    return sendError(res, error);
  }
};

const listarIngresos = async (req, res) => {
  try {
    const ingresos = await service.listEntries({
      dateFrom: req.query.fechaInicio,
      dateTo: req.query.fechaFin,
      brandId: req.query.marcaId,
      modelId: req.query.modeloId,
    });
    return res.json({ ok: true, ingresos });
  } catch (error) {
    return sendError(res, error);
  }
};

const actualizarIngreso = async (req, res) => {
  try {
    const ingreso = await service.updateEntry(
      req.params.ingresoId,
      req.body,
      req.user?.id,
    );
    return res.json({ ok: true, ingreso });
  } catch (error) {
    return sendError(res, error);
  }
};

const eliminarIngreso = async (req, res) => {
  try {
    const ingreso = await service.deleteEntry(req.params.ingresoId);
    return res.json({ ok: true, ingreso });
  } catch (error) {
    return sendError(res, error);
  }
};

const reporte = async (req, res) => {
  try {
    const data = await service.getReport({
      weekStart: req.query.semanaInicio,
      dateFrom: req.query.fechaInicio,
      dateTo: req.query.fechaFin,
      brandId: req.query.marcaId,
      modelId: req.query.modeloId,
    });
    return res.json({ ok: true, ...data });
  } catch (error) {
    return sendError(res, error);
  }
};

const guardarConciliacion = async (req, res) => {
  try {
    const data = await service.saveReconciliation(
      {
        modelId: req.params.modeloId,
        weekStart: req.params.semanaInicio,
        stockCreditek: req.body.stockCreditek,
      },
      req.user?.id,
    );
    return res.json({ ok: true, ...data });
  } catch (error) {
    return sendError(res, error);
  }
};

module.exports = {
  actualizarIngreso,
  catalogos,
  eliminarIngreso,
  guardarConciliacion,
  listarIngresos,
  registrarIngreso,
  reporte,
};
