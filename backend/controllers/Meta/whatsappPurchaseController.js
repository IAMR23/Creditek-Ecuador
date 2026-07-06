const crypto = require("crypto");
const { enviarPurchaseWhatsAppMeta, compactString } = require("../../services/metaConversionsService");

const LOG_PREFIX = "[Meta WhatsApp Purchase]";

const secretsMatch = (providedSecret, expectedSecret) => {
  const provided = Buffer.from(compactString(providedSecret), "utf8");
  const expected = Buffer.from(compactString(expectedSecret), "utf8");

  return provided.length === expected.length && crypto.timingSafeEqual(provided, expected);
};

const recibirPurchaseWhatsApp = async (req, res) => {
  try {
    const payload = req.body || {};
    const webhookSecret = process.env.GHL_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error(`${LOG_PREFIX} GHL_WEBHOOK_SECRET no configurado`);
      return res.status(500).json({
        ok: false,
        message: "Webhook de GHL no configurado",
      });
    }

    if (!secretsMatch(payload.secret, webhookSecret)) {
      return res.status(401).json({
        ok: false,
        message: "No autorizado",
      });
    }

    const ctwaClid = compactString(payload.ctwaClid || payload.ctwa_clid);
    if (!ctwaClid) {
      return res.status(400).json({
        ok: false,
        message: "No se puede atribuir correctamente a WhatsApp Ads sin ctwaClid",
      });
    }

    if (!compactString(payload.opportunityId) && !compactString(payload.contactId)) {
      return res.status(400).json({
        ok: false,
        message: "opportunityId o contactId es requerido",
      });
    }

    const metaResponse = await enviarPurchaseWhatsAppMeta({
      ...payload,
      ctwaClid,
    });

    return res.json({
      ok: true,
      message: "Purchase enviado a Meta",
      meta: metaResponse,
    });
  } catch (error) {
    if (error.code === "META_REJECTED_EVENT") {
      return res.status(error.statusCode || 502).json({
        ok: false,
        message: "Meta rechaz\u00f3 el evento",
        meta: error.meta,
      });
    }

    console.error(`${LOG_PREFIX} error interno`, {
      code: error.code,
      message: error.message,
      statusCode: error.statusCode,
    });

    return res.status(error.statusCode || 500).json({
      ok: false,
      message: error.message || "Error interno enviando Purchase a Meta",
    });
  }
};

module.exports = {
  recibirPurchaseWhatsApp,
};
