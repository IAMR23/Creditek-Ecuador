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

const ECUADOR_PHONE_PATTERN = /^593(?:9\d{8}|[2-7]\d{7})$/;
const PHONE_JID_DOMAINS = new Set(["s.whatsapp.net", "c.us"]);

function limpiarTelefono(phone) {
  if (phone === null || phone === undefined) return null;

  let rawPhone = String(phone).trim();
  if (!rawPhone) return null;

  const jidSeparator = rawPhone.lastIndexOf("@");
  if (jidSeparator >= 0) {
    const jidDomain = rawPhone.slice(jidSeparator + 1).toLowerCase();
    if (!PHONE_JID_DOMAINS.has(jidDomain)) return null;

    rawPhone = rawPhone.slice(0, jidSeparator).split(":", 1)[0];
  }

  let cleaned = rawPhone.replace(/\D/g, "");
  if (cleaned.startsWith("00")) cleaned = cleaned.slice(2);

  if (cleaned.startsWith("0")) {
    cleaned = `593${cleaned.substring(1)}`;
  } else if (/^(?:9\d{8}|[2-7]\d{7})$/.test(cleaned)) {
    cleaned = `593${cleaned}`;
  }

  if (!ECUADOR_PHONE_PATTERN.test(cleaned)) return null;

  return `+${cleaned}`;
}

function findValuesDeep(obj, key, values = [], seen = new Set()) {
  if (!obj || typeof obj !== "object" || seen.has(obj)) return values;
  seen.add(obj);

  if (Object.prototype.hasOwnProperty.call(obj, key)) values.push(obj[key]);

  for (const value of Object.values(obj)) {
    if (value && typeof value === "object") {
      findValuesDeep(value, key, values, seen);
    }
  }

  return values;
}

function extraerTelefonoStevo(payload, { isFromMe = false } = {}) {
  const info = payload?.data?.Info || findValueDeep(payload, ["Info"]) || {};
  const explicitCandidates = isFromMe
    ? [info?.RecipientAlt, info?.Chat, info?.SenderAlt, info?.Sender]
    : [info?.SenderAlt, info?.ChatAlt, info?.Sender, info?.Chat];
  const fallbackKeys = isFromMe
    ? ["RecipientAlt", "phone", "number", "remoteJid", "Chat"]
    : ["SenderAlt", "phone", "number", "remoteJid", "Sender", "sender", "from", "Chat"];
  const candidates = [...explicitCandidates];

  for (const key of fallbackKeys) {
    candidates.push(...findValuesDeep(payload, key));
  }

  for (const candidate of candidates) {
    const phone = limpiarTelefono(candidate);
    if (phone) return phone;
  }

  return null;
}

function parseJsonSafe(value) {
  try {
    if (!value || typeof value !== "string") return null;
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function detectarCampania({ sourceId, sourceUrl, decoded, payload }) {
  const decodedPayload = parseJsonSafe(decoded);
  const payloads = [payload, decodedPayload].filter(Boolean);

  const findInPayloads = (keys) => {
    for (const item of payloads) {
      const found = findValueDeep(item, keys);
      if (found) return found;
    }
    return null;
  };

  const instanceName = findValueDeep(payload, [
    "instanceName",
    "instanceId",
    "instance",
  ]);

  const adTitle = findInPayloads([
    "title",
    "headline",
    "sourceTitle",
    "source_title",
  ]);

  const adBody = findInPayloads([
    "body",
    "description",
    "sourceDescription",
    "source_description",
  ]);
  const decodedSourceId = findInPayloads(["sourceId", "source_id", "adId", "ad_id"]);
  const decodedSourceUrl = findInPayloads(["sourceUrl", "source_url", "sourceURL"]);
  const finalSourceId = sourceId || decodedSourceId;
  const finalSourceUrl = sourceUrl || decodedSourceUrl;

  let origen = "WhatsApp";
  let campania = null;
  let instancia = instanceName || null;

  if (finalSourceId) {
    origen = "Facebook Ads";
    campania = `Meta Source ID ${finalSourceId}`;
  }

  if (finalSourceUrl) {
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
  extraerTelefonoStevo,
  detectarCampania,
};
