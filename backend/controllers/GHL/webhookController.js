

const { enviarAGHL } = require("../../services/ghlService");
const {
  actualizarCedulaContactoDesdeMensaje,
} = require("../../services/ghlCedulaService");
const opportunityWebhookService = require("../../services/ghlOpportunityWebhookService");
const {
  findValueDeep,
  extraerTelefonoStevo,
  decodeBase64,
  detectarCampania,
} = require("../../utils/stevoUtils");

async function recibirWebhookStevo(req, res) {
  try {
    const payload = req.body;

    const info = payload?.data?.Info || findValueDeep(payload, ["Info"]);
    const sourceWebMsg = payload?.data?.SourceWebMsg;

    const isFromMe = info?.IsFromMe === true;

    const sourceId = findValueDeep(payload, [
      "sourceId",
      "source_id",
      "sourceID",
      "adId",
      "ad_id",
      "SourceID",
      "SourceId",
    ]);

    const sourceUrl = findValueDeep(payload, [
      "sourceUrl",
      "source_url",
      "sourceURL",
      "SourceURL",
      "SourceUrl",
    ]);

    const ctwaPayload = findValueDeep(payload, [
      "ctwaPayload",
      "ctwa_payload",
      "CTWAPayload",
    ]);

    const ctwaClid = findValueDeep(payload, [
      "ctwaClid",
      "ctwa_clid",
      "CTWAClid",
      "ctwa_clid",
    ]);

    const rawMessage = findValueDeep(payload, [
      "conversation",
      "text",
      "body",
      "Body",
      "caption",
      "Caption",
      "extendedTextMessage",
    ]);

    const phone = extraerTelefonoStevo(payload, { isFromMe });

    const message =
      typeof rawMessage === "object"
        ? JSON.stringify(rawMessage)
        : rawMessage;

    const decoded = decodeBase64(ctwaPayload);

    const campaniaInfo = detectarCampania({
      sourceId,
      sourceUrl,
      decoded,
      payload,
    });

    /**
     * Esta es la instancia actual del evento.
     * Puede ser 7520, 1413, 8179, etc.
     * Sirve para saber por dónde se está gestionando este mensaje.
     */
    const instanciaActual =
      payload?.instanceName ||
      payload?.data?.instanceName ||
      campaniaInfo.instancia ||
      "";

    /**
     * Esto define si el mensaje realmente viene desde una pauta/anuncio.
     * No basta con tener instanceName, porque cualquier mensaje normal también tiene instanceName.
     */
    const vieneDeAnuncio =
      Boolean(sourceWebMsg) ||
      Boolean(sourceId) ||
      Boolean(sourceUrl) ||
      Boolean(ctwaClid) ||
      Boolean(ctwaPayload) ||
      campaniaInfo.origen === "Meta Ads" ||
      campaniaInfo.origen === "Facebook Ads" ||
      campaniaInfo.origen === "Instagram Ads";

    /**
     * Esta es la instancia que se debe usar para medir pauta.
     * Solo se llena cuando realmente viene de anuncio.
     */
    const instanciaPauta = vieneDeAnuncio ? instanciaActual : "";

  

    let ghlResponse = null;

    if (phone) {
      try {
        ghlResponse = await enviarAGHL({
          phone,
          message,
          origen: campaniaInfo.origen,
          campania: campaniaInfo.campania,

        // Gestión actual del mensaje
          instancia: instanciaActual,

        // Pauta real
          instanciaPauta,
          vieneDeAnuncio,

          sourceId,
          sourceUrl,
          ctwaClid,
          isFromMe,
        });
      } catch (ghlError) {
        console.error("Error GHL", {
          code: ghlError.code || null,
          status: ghlError.response?.status || null,
          message: opportunityWebhookService.logWebhookMessage(ghlError.message),
        });
      }
    } else {
      ghlResponse = { skipped: true, reason: "INVALID_OR_MISSING_PHONE" };
      console.warn("Webhook Stevo omitido: no contiene un telefono ecuatoriano valido.");
    }

    try {
      await actualizarCedulaContactoDesdeMensaje({
        phone,
        message,
        isFromMe,
      });
    } catch (cedulaError) {
      console.error("Error al actualizar el contacto en GHL.", {
        code: cedulaError.code || null,
        status:
          cedulaError.upstreamStatus ||
          cedulaError.statusCode ||
          cedulaError.response?.status ||
          null,
      });
    }

    return res.json({
      ok: true,
      phone,
      message,
      sourceId,
      sourceUrl,
      ctwaClid,
      decoded,
      origen: campaniaInfo.origen,
      campania: campaniaInfo.campania,
      instanciaActual,
      instanciaPauta,
      vieneDeAnuncio,
      isFromMe,
      ghl: ghlResponse,
    });
  } catch (error) {
    console.error("Error en webhook Stevo", {
      code: error.code || null,
      status: error.response?.status || error.statusCode || null,
      message: opportunityWebhookService.logWebhookMessage(error.message),
    });

    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
}

async function recibirWebhookReparto(req, res) {
  const providedSecret = req.get("X-GHL-Webhook-Secret");
  const secretValid = opportunityWebhookService.isValidWebhookSecret(providedSecret);
  if (!secretValid) {
    opportunityWebhookService.logWebhookResult({
      resultado: "FAILED",
      motivo: "INVALID_WEBHOOK_SECRET",
      error: Object.assign(new Error("Webhook no autorizado"), { code: "INVALID_WEBHOOK_SECRET" }),
    });
    return res.status(401).json({ ok: false, code: "INVALID_WEBHOOK_SECRET", message: "Webhook no autorizado" });
  }
  try {
    const result = await opportunityWebhookService.enqueueWebhookEvent(req.body, req.headers);
    return res.status(result.duplicate ? 200 : 202).json({
      ok: true,
      accepted: true,
      duplicate: result.duplicate,
      eventId: result.eventId,
      message: result.duplicate ? "Evento recibido anteriormente" : "Evento aceptado para procesamiento",
    });
  } catch (error) {
    opportunityWebhookService.logWebhookResult({
      resultado: "FAILED",
      motivo: error.code || "GHL_WEBHOOK_ERROR",
      error,
    });
    return res.status(error.statusCode || 500).json({
      ok: false,
      code: error.code || "GHL_WEBHOOK_ERROR",
      message: "No se pudo aceptar el webhook",
    });
  }
}


module.exports = {
  recibirWebhookStevo,
  recibirWebhookReparto,
};
