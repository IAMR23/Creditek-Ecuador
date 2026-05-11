function findValueDeep(obj, keys) {
  if (!obj || typeof obj !== "object") return null;

  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      return obj[key];
    }
  }

  for (const value of Object.values(obj)) {
    if (value && typeof value === "object") {
      const found = findValueDeep(value, keys);
      if (found) return found;
    }
  }

  return null;
}

function decodeBase64(value) {
  try {
    if (!value) return null;
    return Buffer.from(value, "base64").toString("utf8");
  } catch {
    return null;
  }
}

function limpiarTelefono(phone) {
  if (!phone) return null;

  let cleaned = String(phone)
    .replace("@s.whatsapp.net", "")
    .replace("@c.us", "")
    .replace(/\D/g, "");

  if (cleaned.startsWith("0")) {
    cleaned = `593${cleaned.substring(1)}`;
  }

  if (!cleaned.startsWith("593")) {
    cleaned = `593${cleaned}`;
  }

  return `+${cleaned}`;
}

function detectarCampania({ sourceId, sourceUrl, payload }) {
  const instanceName = findValueDeep(payload, [
    "instanceName",
    "instanceId",
    "instance",
  ]);

  const adTitle = findValueDeep(payload, ["title"]);

  const adBody = findValueDeep(payload, [
    "body",
    "description",
  ]);

  let origen = "WhatsApp";
  let campania = null;
  let instancia = instanceName || null;

  if (sourceId) {
    origen = "Facebook Ads";
    campania = `Meta Source ID ${sourceId}`;
  }

  if (sourceUrl) {
    origen = "Facebook Ads";
  }

  if (adBody && String(adBody).toLowerCase().includes("honor x8d")) {
    campania = "Campaña Honor X8D";
  }

  if (adTitle && String(adTitle).toLowerCase().includes("creditek matriz")) {
    origen = "Facebook - Creditek Matriz";
  }

  return {
    origen,
    campania,
    instancia,
    adTitle,
    adBody,
  };
}

module.exports = {
  findValueDeep,
  decodeBase64,
  limpiarTelefono,
  detectarCampania,
};