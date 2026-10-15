const crypto = require("crypto");

const API_KEY_HEADER = "x-api-key";
const MIN_API_KEY_LENGTH = 32;

const CONFIGURACIONES = {
  CELULAR: {
    envName: "API_KEY_RVE",
    integrationName: "reportes-caja-celulares-import",
    codePrefix: "REPORTES_CAJA_CELULARES",
    label: "celulares",
  },
  TV: {
    envName: "API_KEY_RVE",
    integrationName: "reportes-caja-televisiones-import",
    codePrefix: "REPORTES_CAJA_TELEVISIONES",
    label: "televisiones",
  },
};

const digest = (value) =>
  crypto.createHash("sha256").update(String(value), "utf8").digest();

const crearValidadorApiKey = (tipo) => {
  const configuracion = CONFIGURACIONES[tipo];
  if (!configuracion) {
    throw new Error(`Tipo de integracion de reportes caja no soportado: ${tipo}`);
  }

  return (req, res, next) => {
    const configuredKey = String(
      process.env[configuracion.envName] || "",
    ).trim();

    if (configuredKey.length < MIN_API_KEY_LENGTH) {
      console.error(
        `[REPORTES_CAJA_API] Integracion de ${configuracion.label} no configurada`,
        { requestId: req.reportesCajaRequestId },
      );
      return res.status(503).json({
        ok: false,
        code: `${configuracion.codePrefix}_API_KEY_NOT_CONFIGURED`,
        message: `La integracion de ${configuracion.label} no esta configurada en el servidor`,
      });
    }

    const suppliedKey = String(req.get(API_KEY_HEADER) || "").trim();
    if (!suppliedKey) {
      return res.status(401).json({
        ok: false,
        code: `${configuracion.codePrefix}_API_KEY_MISSING`,
        message: `Falta la API key de ${configuracion.label}`,
      });
    }

    if (!crypto.timingSafeEqual(digest(configuredKey), digest(suppliedKey))) {
      console.warn(
        `[REPORTES_CAJA_API] API key de ${configuracion.label} rechazada`,
        { requestId: req.reportesCajaRequestId },
      );
      return res.status(401).json({
        ok: false,
        code: `${configuracion.codePrefix}_API_KEY_INVALID`,
        message: `API key de ${configuracion.label} invalida`,
      });
    }

    req.integration = {
      type: "api_key",
      name: configuracion.integrationName,
    };
    return next();
  };
};

const requireReportesCajaCelularesApiKey = crearValidadorApiKey("CELULAR");
const requireReportesCajaTelevisionesApiKey = crearValidadorApiKey("TV");

module.exports = {
  API_KEY_HEADER,
  MIN_API_KEY_LENGTH,
  requireReportesCajaCelularesApiKey,
  requireReportesCajaTelevisionesApiKey,
};
