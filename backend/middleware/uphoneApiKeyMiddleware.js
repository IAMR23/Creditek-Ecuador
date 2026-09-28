const crypto = require("crypto");
const uphoneLogger = require("../utils/uphoneLogger");

const API_KEY_HEADER = "x-api-key";
const MIN_API_KEY_LENGTH = 32;

const digest = (value) =>
  crypto.createHash("sha256").update(String(value), "utf8").digest();

const requireUphoneApiKey = (req, res, next) => {
  const configuredKey = String(process.env.API_KEY_RVE || "").trim();
  if (configuredKey.length < MIN_API_KEY_LENGTH) {
    uphoneLogger.error(
      "autenticacion no disponible",
      new Error("API key del servidor ausente o demasiado corta"),
      { requestId: req.uphoneRequestId },
    );
    return res.status(503).json({
      ok: false,
      code: "UPHONE_API_KEY_NOT_CONFIGURED",
      message: "La integracion Uphone no esta configurada en el servidor",
    });
  }

  const suppliedKey = String(req.get(API_KEY_HEADER) || "").trim();
  if (!suppliedKey) {
    uphoneLogger.warn("solicitud sin API key", { requestId: req.uphoneRequestId });
    return res.status(401).json({
      ok: false,
      code: "UPHONE_API_KEY_MISSING",
      message: "Falta la API key de Uphone",
    });
  }

  if (!crypto.timingSafeEqual(digest(configuredKey), digest(suppliedKey))) {
    uphoneLogger.warn("API key rechazada", { requestId: req.uphoneRequestId });
    return res.status(401).json({
      ok: false,
      code: "UPHONE_API_KEY_INVALID",
      message: "API key de Uphone invalida",
    });
  }

  req.integration = { type: "api_key", name: "uphone-import" };
  uphoneLogger.info("API key aceptada", { requestId: req.uphoneRequestId });
  return next();
};

module.exports = {
  API_KEY_HEADER,
  MIN_API_KEY_LENGTH,
  requireUphoneApiKey,
};
