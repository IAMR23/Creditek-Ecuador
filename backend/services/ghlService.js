const axios = require("axios");

const GHL_TOKEN = process.env.GHL_TOKEN;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;

async function enviarAGHL({
  phone,
  message,
  origen,
  campania,
  instancia,
  sourceId,
  sourceUrl,
  ctwaClid,
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
  ];

  if (hayCampaniaDetectada) {
    customFields.push({
      key: "campania_origen",
      field_value: instancia,
    });
  }

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

  const tags = ["WhatsApp Entrante"];

  if (origen) {
    tags.push(origen);
  }

  if (hayCampaniaDetectada) {
    tags.push(campania);
  }

  const payloadGHL = {
    locationId: GHL_LOCATION_ID,
    phone,
    source: "WhatsApp Stevo",
    tags,
    customFields,
  };

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