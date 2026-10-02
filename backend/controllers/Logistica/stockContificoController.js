const stockService = require("../../services/contificoStockService");

const parseRefresh = (value) => value === "true" || value === "1";

const parseIntegerQuery = (value, { name, fallback, minimum = 0, maximum }) => {
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(String(value))) {
    const error = new Error(`${name} debe ser un numero entero.`);
    error.code = "INVALID_QUERY_PARAMETER";
    error.httpStatus = 400;
    throw error;
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    const error = new Error(`${name} esta fuera del rango permitido.`);
    error.code = "INVALID_QUERY_PARAMETER";
    error.httpStatus = 400;
    throw error;
  }
  return parsed;
};

const sendError = (res, error) => {
  const status = error.httpStatus || 500;
  if (status >= 500) {
    console.error("Error consultando stock Contifico", {
      code: error.code || "CONTIFICO_INTERNAL_ERROR",
      message: error.message,
    });
  }

  return res.status(status).json({
    ok: false,
    code: error.code || "CONTIFICO_INTERNAL_ERROR",
    message:
      status >= 500 && !error.code
        ? "No fue posible procesar la consulta de stock."
        : error.message,
  });
};

const catalogo = async (req, res) => {
  try {
    const data = await stockService.getCatalog({
      forceRefresh: parseRefresh(req.query.actualizar),
    });
    return res.json({ ok: true, ...data });
  } catch (error) {
    return sendError(res, error);
  }
};

const stockProducto = async (req, res) => {
  try {
    const data = await stockService.getProductStock(req.params.productoId, {
      forceRefresh: parseRefresh(req.query.actualizar),
    });
    return res.json({ ok: true, ...data });
  } catch (error) {
    return sendError(res, error);
  }
};

const stockBodega = async (req, res) => {
  try {
    const offset = parseIntegerQuery(req.query.offset, {
      name: "offset",
      fallback: 0,
      minimum: 0,
      maximum: 100000,
    });
    const limit = parseIntegerQuery(req.query.limit, {
      name: "limit",
      fallback: 20,
      minimum: 1,
      maximum: stockService.MAX_BATCH_SIZE,
    });
    const data = await stockService.getWarehouseStock(req.params.bodegaId, {
      offset,
      limit,
      forceRefresh: parseRefresh(req.query.actualizar),
    });
    return res.json({ ok: true, ...data });
  } catch (error) {
    return sendError(res, error);
  }
};

const coberturaBodegas = async (req, res) => {
  try {
    const offset = parseIntegerQuery(req.query.offset, {
      name: "offset",
      fallback: 0,
      minimum: 0,
      maximum: 100000,
    });
    const limit = parseIntegerQuery(req.query.limit, {
      name: "limit",
      fallback: 20,
      minimum: 1,
      maximum: stockService.MAX_BATCH_SIZE,
    });
    const data = await stockService.getProductWarehouseCoverage({
      offset,
      limit,
      forceRefresh: parseRefresh(req.query.actualizar),
    });
    return res.json({ ok: true, ...data });
  } catch (error) {
    return sendError(res, error);
  }
};

module.exports = { catalogo, coberturaBodegas, stockBodega, stockProducto };
