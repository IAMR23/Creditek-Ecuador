

const { enviarAGHL } = require("../../services/ghlService");
const { findValueDeep, limpiarTelefono, decodeBase64, detectarCampania } = require("../../utils/stevoUtils");

async function recibirWebhookStevo(req, res) {
  try {
    const payload = req.body;

    const info = payload?.data?.Info;
    const sourceWebMsg = payload?.data?.SourceWebMsg;

    const isFromMe = info?.IsFromMe === true;

    console.dir(payload, { depth: null });

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

    const rawPhone = isFromMe
      ? info?.Chat ||
        info?.RecipientAlt ||
        findValueDeep(payload, ["Chat", "RecipientAlt"])
      : findValueDeep(payload, [
          "remoteJid",
          "from",
          "sender",
          "Sender",
          "phone",
          "number",
          "Chat",
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

    const phone = limpiarTelefono(rawPhone);

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

      console.dir(ghlResponse, { depth: null });
    } catch (ghlError) {
      console.error("\n❌ ERROR ENVIANDO A GHL");

      if (ghlError.response) {
        console.error("Status:", ghlError.response.status);
        console.error("Data:", ghlError.response.data);
      } else {
        console.error(ghlError.message);
      }
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
    console.error("Error en webhook Stevo:", error);

    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
}


module.exports = {
  recibirWebhookStevo,
};