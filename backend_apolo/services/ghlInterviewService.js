const DEFAULT_BASE_URL = "https://services.leadconnectorhq.com";
const CONTACTS_VERSION = "2021-07-28";
const MESSAGE_HUB_VERSION = "v3";
const INTERVIEW_LINK =
  "https://api.leadconnectorhq.com/widget/booking/AykuUIDyRMCmeMRz4KgZ";

const serviceError = (message, code, statusCode = 400) =>
  Object.assign(new Error(message), { code, statusCode });

const compact = (value) => String(value || "").trim();

const normalizeName = (value) =>
  compact(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const normalizeEcuadorMobilePhone = (value) => {
  const digits = compact(value).replace(/\D/g, "");
  if (/^09\d{8}$/.test(digits)) return `+593${digits.slice(1)}`;
  if (/^5939\d{8}$/.test(digits)) return `+${digits}`;
  if (/^59399\d{8}$/.test(digits)) return `+593${digits.slice(4)}`;
  if (/^9\d{8}$/.test(digits)) return `+593${digits}`;
  return "";
};

const getConfig = () => {
  const token = process.env.ghl_token_abs || process.env.GHL_TOKEN_ABS;
  const locationId =
    process.env.ghl_location_id_abs || process.env.GHL_LOCATION_ID_ABS;
  const baseUrl = compact(process.env.GHL_BASE_URL_ABS || DEFAULT_BASE_URL).replace(
    /\/+$/,
    "",
  );
  const missing = [];
  if (!token) missing.push("ghl_token_abs");
  if (!locationId) missing.push("ghl_location_id_abs");
  if (missing.length) {
    throw serviceError(
      `Falta configurar ${missing.join(", ")} en el backend de ABS.`,
      "GHL_ABS_CONFIG_MISSING",
      500,
    );
  }
  return { token, locationId, baseUrl };
};

const parseResponse = async (response) => {
  const contentType = response.headers?.get?.("content-type") || "";
  if (contentType.includes("application/json")) return response.json();
  const text = await response.text();
  return text ? { message: text } : {};
};

const requestGhl = async (config, path, options = {}, request = fetch) => {
  let response;
  try {
    response = await request(`${config.baseUrl}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${config.token}`,
        Accept: "application/json",
        ...(options.headers || {}),
      },
      signal: AbortSignal.timeout(20000),
    });
  } catch (error) {
    throw serviceError(
      error?.name === "TimeoutError"
        ? "HighLevel no respondio a tiempo."
        : "No se pudo conectar con HighLevel.",
      "GHL_ABS_CONNECTION_ERROR",
      502,
    );
  }

  const payload = await parseResponse(response);
  if (response.ok) return payload;

  if (response.status === 401) {
    throw serviceError(
      "El token de HighLevel para ABS es invalido o vencio.",
      "GHL_ABS_UNAUTHORIZED",
      502,
    );
  }
  if (response.status === 403) {
    throw serviceError(
      "El token de HighLevel para ABS no tiene los permisos requeridos.",
      "GHL_ABS_FORBIDDEN",
      502,
    );
  }

  throw serviceError(
    compact(payload?.message || payload?.error) ||
      "HighLevel rechazo el envio de la entrevista.",
    "GHL_ABS_UPSTREAM_ERROR",
    502,
  );
};

const selectMessageHubProvider = (providers = []) => {
  const configuredName = normalizeName(
    process.env.GHL_MESSAGE_HUB_PROVIDER_NAME_ABS || "Whatsapp",
  );
  return (
    providers.find((provider) => normalizeName(provider?.name) === configuredName) ||
    providers.find((provider) => {
      const name = normalizeName(provider?.name);
      return (
        name.includes("whatsapp") ||
        name.includes("message hub") ||
        name.includes("messagesync")
      );
    }) ||
    null
  );
};

const extractContactId = (payload) =>
  compact(
    payload?.contact?.id ||
      payload?.contact?._id ||
      payload?.data?.contact?.id ||
      payload?.data?.id ||
      payload?.contactId,
  );

const sendInterviewLink = async (
  { phone, instanceIndex },
  dependencies = {},
) => {
  const normalizedPhone = normalizeEcuadorMobilePhone(phone);
  if (!normalizedPhone) {
    throw serviceError(
      "El postulante no tiene un numero movil ecuatoriano valido.",
      "POSTULANTE_PHONE_INVALID",
    );
  }

  const instance = Number.parseInt(instanceIndex, 10);
  if (!Number.isInteger(instance) || instance < 1 || instance > 5) {
    throw serviceError(
      "Seleccione una instancia de envio entre 1 y 5.",
      "GHL_ABS_INSTANCE_INVALID",
    );
  }

  const config = dependencies.getConfig?.() || getConfig();
  const request = dependencies.fetch || fetch;
  const providersPayload = await requestGhl(
    config,
    `/locations/${encodeURIComponent(config.locationId)}/conversationChannels/SMS`,
    { method: "GET", headers: { Version: MESSAGE_HUB_VERSION } },
    request,
  );
  const providerRows =
    providersPayload?.conversationChannel?.SMS ||
    providersPayload?.data?.conversationChannel?.SMS ||
    [];
  const providers = Array.isArray(providerRows)
    ? providerRows.map((row) => row?.conversationProvider || row).filter(Boolean)
    : [];
  const provider = selectMessageHubProvider(providers);
  const providerId = compact(provider?._id || provider?.id);
  if (!providerId) {
    throw serviceError(
      "Message Hub no esta configurado como proveedor de conversaciones en HighLevel ABS.",
      "GHL_ABS_PROVIDER_NOT_FOUND",
      409,
    );
  }

  const contactPayload = await requestGhl(
    config,
    "/contacts/upsert",
    {
      method: "POST",
      headers: {
        Version: CONTACTS_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        locationId: config.locationId,
        phone: normalizedPhone,
        country: "EC",
        createNewIfDuplicateAllowed: false,
      }),
    },
    request,
  );
  const contactId = extractContactId(contactPayload);
  if (!contactId) {
    throw serviceError(
      "HighLevel no pudo crear o localizar el contacto del postulante.",
      "GHL_ABS_CONTACT_NOT_RESOLVED",
      502,
    );
  }

  const messagePayload = await requestGhl(
    config,
    "/conversations/messages",
    {
      method: "POST",
      headers: {
        Version: MESSAGE_HUB_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "SMS",
        contactId,
        conversationProviderId: providerId,
        message: `${INTERVIEW_LINK}\n\n{ WA#${instance} }`,
      }),
    },
    request,
  );

  return {
    phone: normalizedPhone,
    instanceIndex: instance,
    messageId: compact(messagePayload?.messageId || messagePayload?.data?.messageId) || null,
  };
};

module.exports = {
  INTERVIEW_LINK,
  normalizeEcuadorMobilePhone,
  selectMessageHubProvider,
  sendInterviewLink,
};
