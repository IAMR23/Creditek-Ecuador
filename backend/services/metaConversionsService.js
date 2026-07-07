const crypto = require("crypto");
const axios = require("axios");

const GRAPH_BASE_URL = "https://graph.facebook.com";

const compactString = (value) => {
  if (value === null || value === undefined) return "";
  return String(value).trim();
};

const normalizeHashValue = (value) => compactString(value).toLowerCase();

const normalizePhone = (value) => compactString(value).replace(/\D/g, "");

const hashSha256 = (value) => {
  const normalized = compactString(value);
  if (!normalized) return "";

  return crypto.createHash("sha256").update(normalized).digest("hex");
};

const normalizeCurrency = (value) => {
  const currency = compactString(value).toUpperCase();
  return currency || "USD";
};

const parseSaleValue = (value) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const rawValue = compactString(value);
  if (!rawValue) return 0;

  const sanitized = rawValue.replace(/[^0-9,.-]/g, "");
  const decimalNormalized =
    sanitized.includes(",") && !sanitized.includes(".")
      ? sanitized.replace(",", ".")
      : sanitized.replace(/,/g, "");
  const parsed = Number(decimalNormalized);

  return Number.isFinite(parsed) ? parsed : 0;
};

const getMetaConfig = () => {
  const config = {
    apiVersion: compactString(process.env.META_API_VERSION),
    datasetId: compactString(process.env.META_DATASET_ID),
    accessToken: compactString(process.env.META_ACCESS_TOKEN),
    pageId: compactString(process.env.META_PAGE_ID),
  };

  const missing = [];
  if (!config.apiVersion) missing.push("META_API_VERSION");
  if (!config.datasetId) missing.push("META_DATASET_ID");
  if (!config.accessToken) missing.push("META_ACCESS_TOKEN");
  if (!config.pageId) missing.push("META_PAGE_ID");

  if (missing.length) {
    const error = new Error(`Falta configurar ${missing.join(", ")} en el .env`);
    error.code = "META_CONFIG_MISSING";
    error.statusCode = 500;
    throw error;
  }

  return config;
};

const buildMetaEventsUrl = (config) => {
  const apiVersion = compactString(config.apiVersion).replace(/^\/+|\/+$/g, "");
  const datasetId = encodeURIComponent(compactString(config.datasetId));
  const accessToken = encodeURIComponent(compactString(config.accessToken));

  return `${GRAPH_BASE_URL}/${apiVersion}/${datasetId}/events?access_token=${accessToken}`;
};

const addHashedField = (userData, key, value, normalizer = normalizeHashValue) => {
  const normalized = normalizer(value);
  if (!normalized) return;

  userData[key] = hashSha256(normalized);
};

const buildWhatsappPurchasePayload = (input, config, options = {}) => {
  const opportunityId = compactString(input.opportunityId);
  const contactId = compactString(input.contactId);
  const eventSourceId = opportunityId || contactId;

  if (!eventSourceId) {
    const error = new Error("opportunityId o contactId es requerido para event_id");
    error.code = "META_EVENT_ID_REQUIRED";
    error.statusCode = 400;
    throw error;
  }

  const userData = {
    page_id: compactString(config.pageId),
    ctwa_clid: compactString(input.ctwaClid),
    client_user_agent: compactString(input.clientUserAgent) || "GHL-Webhook",
  };

  addHashedField(userData, "ph", input.phone, normalizePhone);
  addHashedField(userData, "em", input.email);
  addHashedField(userData, "fn", input.firstName);
  addHashedField(userData, "ln", input.lastName);

  const customData = {
    currency: normalizeCurrency(input.currency),
    value: parseSaleValue(input.value),
  };

  const productName = compactString(input.productName);
  const productCategory = compactString(input.productCategory);

  if (productName) customData.content_name = productName;
  if (productCategory) customData.content_category = productCategory;

  return {
    data: [
      {
        event_name: "Purchase",
        event_time: options.eventTime || Math.floor(Date.now() / 1000),
        action_source: "business_messaging",
        messaging_channel: "whatsapp",
        event_source_url: compactString(input.sourceUrl) || "https://wa.me/593984065314",
        event_id: `ghl_purchase_${eventSourceId}`,
        user_data: userData,
        custom_data: customData,
      },
    ],
  };
};

const normalizeMetaError = (error) => {
  if (error.response) {
    const serviceError = new Error("Meta rechazo el evento");
    serviceError.code = "META_REJECTED_EVENT";
    serviceError.statusCode = 502;
    serviceError.meta = error.response.data || {
      status: error.response.status,
      statusText: error.response.statusText,
    };
    return serviceError;
  }

  const serviceError = new Error(
    error.code === "ECONNABORTED"
      ? "Meta no respondio a tiempo"
      : "No se pudo conectar con Meta"
  );
  serviceError.code = "META_CONNECTION_ERROR";
  serviceError.statusCode = 500;
  return serviceError;
};

const enviarPurchaseWhatsAppMeta = async (input) => {
  const config = getMetaConfig();
  const payload = buildWhatsappPurchasePayload(input, config);
  const url = buildMetaEventsUrl(config);

  try {
    const response = await axios.post(url, payload, {
      headers: {
        "Content-Type": "application/json",
      },
      timeout: 15000,
    });

    return response.data;
  } catch (error) {
    throw normalizeMetaError(error);
  }
};

module.exports = {
  enviarPurchaseWhatsAppMeta,
  buildWhatsappPurchasePayload,
  buildMetaEventsUrl,
  compactString,
  hashSha256,
  normalizeCurrency,
  normalizePhone,
  parseSaleValue,
};
