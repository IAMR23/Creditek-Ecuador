const {
  createGhlClient,
  getGhlConfig,
  requestGhl,
  toId,
} = require("./ghlService");
const {
  esCedulaEcuatorianaValida,
  normalizarPosibleCedula,
} = require("./ghlCedulaService");

const LANDING_SOURCE = "Landing Creditek - Solicitud de crédito";
const LANDING_ORIGIN = "Landing Page";
const CONTACTS_API_VERSION = "2021-07-28";
const CUSTOM_FIELDS_CACHE_MS = 5 * 60 * 1000;
const PRODUCT_TYPES = Object.freeze(["Celular", "Tablet", "Televisor"]);
const PROVINCES = Object.freeze([
  "Azuay",
  "Bolívar",
  "Cañar",
  "Carchi",
  "Chimborazo",
  "Cotopaxi",
  "El Oro",
  "Esmeraldas",
  "Galápagos",
  "Guayas",
  "Imbabura",
  "Loja",
  "Los Ríos",
  "Manabí",
  "Morona Santiago",
  "Napo",
  "Orellana",
  "Pastaza",
  "Pichincha",
  "Santa Elena",
  "Santo Domingo de los Tsáchilas",
  "Sucumbíos",
  "Tungurahua",
  "Zamora Chinchipe",
]);

let customFieldsCache = null;

const normalizeComparable = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const normalizeFieldKey = (value) =>
  String(value || "")
    .trim()
    .replace(/^\{\{\s*/, "")
    .replace(/\s*\}\}$/, "")
    .trim()
    .toLowerCase();

const normalizeName = (value) => String(value || "").trim().replace(/\s+/g, " ");

const splitFullName = (value) => {
  const name = normalizeName(value);
  const parts = name.split(" ").filter(Boolean);
  if (parts.length < 2) return null;

  const surnameCount = parts.length >= 3 ? 2 : 1;
  return {
    name,
    firstName: parts.slice(0, -surnameCount).join(" "),
    lastName: parts.slice(-surnameCount).join(" "),
  };
};

const normalizeEcuadorPhone = (value) => {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("00593")) digits = digits.slice(2);
  if (/^09\d{8}$/.test(digits)) return `+593${digits.slice(1)}`;
  if (/^5939\d{8}$/.test(digits)) return `+${digits}`;
  return null;
};

const canonicalValue = (value, allowedValues) => {
  const comparable = normalizeComparable(value);
  return allowedValues.find((item) => normalizeComparable(item) === comparable) || null;
};

const validationError = (errors) => {
  const error = new Error("Los datos de la solicitud no son válidos");
  error.code = "LANDING_CREDIT_VALIDATION_ERROR";
  error.statusCode = 422;
  error.validationErrors = errors;
  return error;
};

const validateLandingCreditApplication = (input = {}) => {
  const errors = {};
  const isObject = input && typeof input === "object" && !Array.isArray(input);
  if (!isObject) throw validationError({ form: "La solicitud no es válida" });

  const parsedName = typeof input.fullName === "string" ? splitFullName(input.fullName) : null;
  const cedula = typeof input.cedula === "string" ? normalizarPosibleCedula(input.cedula) : null;
  const phone = typeof input.phone === "string" ? normalizeEcuadorPhone(input.phone) : null;
  const province = typeof input.province === "string"
    ? canonicalValue(input.province, PROVINCES)
    : null;
  const productType = typeof input.productType === "string"
    ? canonicalValue(input.productType, PRODUCT_TYPES)
    : null;
  const validNameCharacters = parsedName
    ? /^[\p{L}\p{M}.'’-]+(?:\s+[\p{L}\p{M}.'’-]+)+$/u.test(parsedName.name)
    : false;

  if (!parsedName || parsedName.name.length > 120 || !validNameCharacters) {
    errors.fullName = "Ingresa nombres y apellidos válidos";
  }
  if (!cedula || !esCedulaEcuatorianaValida(cedula)) {
    errors.cedula = "Ingresa una cédula ecuatoriana válida";
  }
  if (!phone) errors.phone = "Ingresa un número móvil ecuatoriano válido";
  if (!province) errors.province = "Selecciona una provincia válida";
  if (!productType) errors.productType = "Selecciona un producto válido";
  if (
    (input.website !== undefined && typeof input.website !== "string") ||
    String(input.website || "").trim()
  ) {
    errors.form = "La solicitud no es válida";
  }

  if (Object.keys(errors).length) throw validationError(errors);

  return {
    ...parsedName,
    cedula,
    phone,
    province,
    productType,
  };
};

const extractCustomFields = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  return (
    payload.customFields ||
    payload.custom_fields ||
    payload.fields ||
    payload.data?.customFields ||
    payload.data?.custom_fields ||
    payload.data?.fields ||
    (Array.isArray(payload.data) ? payload.data : [])
  );
};

const getRequiredFieldKeys = () => ({
  province: process.env.GHL_LANDING_PROVINCE_FIELD_KEY || "contact.provincia",
  cedula: process.env.GHL_LANDING_CEDULA_FIELD_KEY || "contact.cdula",
  productType: process.env.GHL_LANDING_PRODUCT_FIELD_KEY || "contact.dispositivo",
  origin: process.env.GHL_LANDING_ORIGIN_FIELD_KEY || "contact.origen",
});

const resolveCustomFieldIds = (definitions, fieldKeys = getRequiredFieldKeys()) => {
  const byKey = new Map(
    definitions
      .filter(Boolean)
      .map((definition) => [normalizeFieldKey(definition.fieldKey || definition.key), definition]),
  );
  const resolved = {};
  const missing = [];

  for (const [name, fieldKey] of Object.entries(fieldKeys)) {
    const definition = byKey.get(normalizeFieldKey(fieldKey));
    const id = toId(definition?.id || definition?._id || definition?.customFieldId);
    if (!id) missing.push(fieldKey);
    else resolved[name] = id;
  }

  if (missing.length) {
    const error = new Error("Faltan campos personalizados de GHL para la solicitud de crédito");
    error.code = "GHL_LANDING_CUSTOM_FIELD_MISSING";
    error.statusCode = 503;
    error.missingFieldKeys = missing;
    throw error;
  }

  return resolved;
};

const fetchCustomFieldDefinitions = async ({ client, config, executeRequest }) => {
  const now = Date.now();
  if (customFieldsCache && customFieldsCache.expiresAt > now) {
    return customFieldsCache.definitions;
  }

  const payload = await executeRequest(client, {
    method: "GET",
    url: `/locations/${encodeURIComponent(config.locationId)}/customFields`,
    params: { model: "contact" },
    retryOn5xx: true,
  });
  const definitions = extractCustomFields(payload).filter(Boolean);
  customFieldsCache = { definitions, expiresAt: now + CUSTOM_FIELDS_CACHE_MS };
  return definitions;
};

const extractConfirmedContact = (payload) => {
  if (!payload || typeof payload !== "object" || payload.succeeded === false) return null;
  const contact = payload.contact || payload.data?.contact || payload.data;
  const contactId = toId(contact?.id || contact?._id || contact?.contactId);
  return contactId ? { contactId, contact } : null;
};

const submitLandingCreditApplication = async (input, dependencies = {}) => {
  const application = validateLandingCreditApplication(input);
  const configFactory = dependencies.getGhlConfig || getGhlConfig;
  const clientFactory = dependencies.createGhlClient || createGhlClient;
  const executeRequest = dependencies.requestGhl || requestGhl;
  const config = configFactory({ requirePipelineId: false });
  const client = dependencies.client || clientFactory(config);
  const definitions = dependencies.customFieldDefinitions || await fetchCustomFieldDefinitions({
    client,
    config,
    executeRequest,
  });
  const fieldIds = resolveCustomFieldIds(
    definitions,
    dependencies.fieldKeys || getRequiredFieldKeys(),
  );

  const payload = await executeRequest(client, {
    method: "POST",
    url: "/contacts/upsert",
    headers: {
      Version: process.env.GHL_CONTACTS_API_VERSION || CONTACTS_API_VERSION,
      "Content-Type": "application/json",
    },
    retryOn5xx: false,
    data: {
      locationId: config.locationId,
      name: application.name,
      firstName: application.firstName,
      lastName: application.lastName,
      phone: application.phone,
      country: "EC",
      source: LANDING_SOURCE,
      createNewIfDuplicateAllowed: false,
      customFields: [
        { id: fieldIds.province, fieldValue: application.province },
        { id: fieldIds.cedula, fieldValue: application.cedula },
        { id: fieldIds.productType, fieldValue: application.productType },
        { id: fieldIds.origin, fieldValue: LANDING_ORIGIN },
      ],
    },
  });

  const confirmed = extractConfirmedContact(payload);
  if (!confirmed) {
    const error = new Error("GHL no confirmó la creación o actualización del contacto");
    error.code = "GHL_CONTACT_NOT_CONFIRMED";
    error.statusCode = 502;
    throw error;
  }

  return {
    contactId: confirmed.contactId,
    created: payload.new === true,
  };
};

const resetCustomFieldsCacheForTests = () => {
  customFieldsCache = null;
};

module.exports = {
  LANDING_SOURCE,
  LANDING_ORIGIN,
  PRODUCT_TYPES,
  PROVINCES,
  extractConfirmedContact,
  normalizeEcuadorPhone,
  resolveCustomFieldIds,
  splitFullName,
  submitLandingCreditApplication,
  validateLandingCreditApplication,
  resetCustomFieldsCacheForTests,
};
