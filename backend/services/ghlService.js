const axios = require("axios");

const GHL_TOKEN = process.env.GHL_TOKEN;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;

async function enviarAGHL({
  phone,
  message,
  origen,
  campania,

  // Instancia actual del mensaje: gestión / extensión actual
  instancia,

  // Instancia real de la pauta: solo viene cuando vieneDeAnuncio === true
  instanciaPauta,

  sourceId,
  sourceUrl,
  ctwaClid,
  isFromMe,
  vieneDeAnuncio,
}) {
  if (!GHL_TOKEN) {
    throw new Error("Falta GHL_TOKEN en el archivo .env");
  }

  if (!GHL_LOCATION_ID) {
    throw new Error("Falta GHL_LOCATION_ID en el archivo .env");
  }

  if (!phone) {
    throw new Error("No se pudo detectar el teléfono del cliente");
  }

  const hayCampaniaDetectada =
    campania &&
    campania !== "Sin campaña detectada" &&
    String(campania).trim() !== "";

  const customFields = [
    {
      key: "origen_ultimo_mensaje",
      field_value: origen || "WhatsApp",
    },
    {
      key: "instancia_entrada",
      field_value: instancia || "",
    },
    {
      key: "ultimo_mensaje_whatsapp",
      field_value: message || "",
    },
    {
      key: "tipo_ultimo_mensaje",
      field_value: isFromMe ? "Asesor" : "Cliente",
    },
  ];

  /**
   * Gestión actual.
   * Este campo SÍ puede cambiar.
   * Ejemplo:
   * - Llegó por 7520
   * - Luego lo gestiona 1413
   * Entonces instancia_gestion puede pasar a 1413.
   */
  if (instancia) {
    customFields.push({
      key: "instancia_gestion",
      field_value: instancia,
    });
  }

  /**
   * Origen real de pauta.
   * Este campo NO debe cambiar por mensajes normales o respuestas del asesor.
   * Solo se actualiza cuando el mensaje realmente trae datos de anuncio.
   */
  if (vieneDeAnuncio && instanciaPauta) {
    customFields.push({
      key: "campania_origen",
      field_value: instanciaPauta,
    });
  }

  /**
   * Nombre de campaña detectada.
   * Opcional, solo si tienes este custom field creado en GHL.
   */
  if (vieneDeAnuncio && hayCampaniaDetectada) {
    customFields.push({
      key: "nombre_campania_meta",
      field_value: campania,
    });
  }

  /**
   * Datos Meta.
   * Solo se mandan si existen.
   */
  if (sourceId) {
    customFields.push({
      key: "meta_source_id",
      field_value: sourceId,
    });
  }

  if (sourceUrl) {
    customFields.push({
      key: "meta_source_url",
      field_value: sourceUrl,
    });
  }

  if (ctwaClid) {
    customFields.push({
      key: "ctwa_clid",
      field_value: ctwaClid,
    });
  }

  const payloadGHL = {
    locationId: GHL_LOCATION_ID,
    phone,
    source: vieneDeAnuncio
      ? "WhatsApp Stevo - Meta Ads"
      : isFromMe
        ? "WhatsApp Stevo - Asesor"
        : "WhatsApp Stevo - Cliente",
    customFields,
  };

  console.log("📤 PAYLOAD GHL:");
  console.dir(payloadGHL, { depth: null });

  const response = await axios.post(
    "https://services.leadconnectorhq.com/contacts/upsert",
    payloadGHL,
    {
      headers: {
        Authorization: `Bearer ${GHL_TOKEN}`,
        Version: "2021-07-28",
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      timeout: 15000,
    }
  );

  return response.data;
}

module.exports = {
  enviarAGHL,
};