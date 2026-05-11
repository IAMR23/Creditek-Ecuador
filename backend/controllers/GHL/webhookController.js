

const { enviarAGHL } = require("../../services/ghlService");
const { findValueDeep, limpiarTelefono, decodeBase64, detectarCampania } = require("../../utils/stevoUtils");

async function recibirWebhookStevo(req, res) {
  try {
    const payload = req.body;

    console.log("\n==============================");
    console.log("📩 WEBHOOK STEVO RECIBIDO");
    console.log("==============================\n");

    console.dir(payload, { depth: null });

    const sourceId = findValueDeep(payload, [
      "sourceId",
      "source_id",
      "sourceID",
      "adId",
      "ad_id",
    ]);

    const sourceUrl = findValueDeep(payload, [
      "sourceUrl",
      "source_url",
      "sourceURL",
    ]);

    const ctwaPayload = findValueDeep(payload, [
      "ctwaPayload",
      "ctwa_payload",
    ]);

    const ctwaClid = findValueDeep(payload, [
      "ctwaClid",
      "ctwa_clid",
    ]);

    const rawPhone = findValueDeep(payload, [
      "remoteJid",
      "from",
      "sender",
      "Sender",
      "phone",
      "number",
    ]);

    const rawMessage = findValueDeep(payload, [
      "conversation",
      "text",
      "body",
      "Body",
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

    console.log("\n🔥 DATOS PROCESADOS\n");
    console.log("📱 Teléfono:", phone);
    console.log("💬 Mensaje:", message);
    console.log("📢 Source ID:", sourceId);
    console.log("🌐 Source URL:", sourceUrl);
    console.log("🧠 CTWA CLID:", ctwaClid);
    console.log("🎯 Origen:", campaniaInfo.origen);
    console.log("🎯 Campaña:", campaniaInfo.campania);
    console.log("🎯 Instancia:", campaniaInfo.instancia);

    let ghlResponse = null;

    try {
      ghlResponse = await enviarAGHL({
        phone,
        message,
        origen: campaniaInfo.origen,
        campania: campaniaInfo.campania,
        instancia: campaniaInfo.instancia,
        sourceId,
        sourceUrl,
        ctwaClid,
      });

      console.log("\n✅ CONTACTO ENVIADO A GHL");
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
      instancia: campaniaInfo.instancia,
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