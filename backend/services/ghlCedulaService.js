const {
  createGhlClient,
  extractContacts,
  getGhlConfig,
  requestGhl,
  toId,
} = require("./ghlService");

const CEDULA_FIELD_KEY = "contact.cdula";
const CONTACTS_API_VERSION = "2021-07-28";

const normalizarPosibleCedula = (value) => {
  const normalized = String(value || "").replace(/[\s.-]/g, "");
  return /^\d{10}$/.test(normalized) ? normalized : null;
};

const esCedulaEcuatorianaValida = (value) => {
  const cedula = normalizarPosibleCedula(value);
  if (!cedula) return false;

  const provinceCode = Number(cedula.slice(0, 2));
  if (provinceCode < 1 || provinceCode > 24) return false;
  if (Number(cedula[2]) >= 6) return false;

  const checksumTotal = cedula
    .slice(0, 9)
    .split("")
    .reduce((total, digit, index) => {
      let product = Number(digit) * (index % 2 === 0 ? 2 : 1);
      if (product > 9) product -= 9;
      return total + product;
    }, 0);
  const verifier = (10 - (checksumTotal % 10)) % 10;

  return verifier === Number(cedula[9]);
};

const detectarCedulaEcuatoriana = (message) => {
  if (typeof message !== "string" && typeof message !== "number") return null;

  const numericSegments = String(message).match(/\d(?:[\d\s.-]*\d)?/g) || [];
  for (const segment of numericSegments) {
    const cedula = normalizarPosibleCedula(segment);
    if (cedula && esCedulaEcuatorianaValida(cedula)) return cedula;
  }

  return null;
};

const normalizarFieldKey = (value) =>
  String(value || "")
    .trim()
    .replace(/^\{\{\s*/, "")
    .replace(/\s*\}\}$/, "")
    .trim()
    .toLowerCase();

const extraerDefinicionesCampos = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];

  const candidates = [
    payload.customFields,
    payload.custom_fields,
    payload.fields,
    payload.data?.customFields,
    payload.data?.custom_fields,
    payload.data?.fields,
    payload.data,
  ];
  return candidates.find(Array.isArray) || [];
};

const encontrarCampoCedula = (definitions = []) =>
  definitions.find((definition) =>
    [definition?.fieldKey, definition?.key].some(
      (identifier) => normalizarFieldKey(identifier) === CEDULA_FIELD_KEY,
    ),
  ) || null;

const extraerValorCampo = (field = {}) => {
  const value = field.fieldValue ?? field.field_value ?? field.value;
  return value === null || value === undefined ? "" : String(value).trim();
};

const obtenerValorCampoContacto = (contact, customFieldId) => {
  const customFields = Array.isArray(contact?.customFields)
    ? contact.customFields
    : Array.isArray(contact?.custom_fields)
      ? contact.custom_fields
      : [];
  const field = customFields.find(
    (item) => toId(item?.id || item?._id || item?.customFieldId) === customFieldId,
  );
  return field ? extraerValorCampo(field) : "";
};

const normalizarTelefonoComparable = (value) => String(value || "").replace(/\D/g, "");

const encontrarContactoExacto = (contacts, phone) => {
  const comparablePhone = normalizarTelefonoComparable(phone);
  const exactContact = contacts.find(
    (contact) => normalizarTelefonoComparable(contact?.phone) === comparablePhone,
  );
  return exactContact || (contacts.length === 1 ? contacts[0] : null);
};

const extraerContactoDesdeUpsert = (payload) => {
  if (!payload || typeof payload !== "object") return null;

  const candidates = [
    payload.contact,
    payload.data?.contact,
    payload.data,
    payload,
  ];

  return candidates.find((candidate) =>
    candidate &&
    typeof candidate === "object" &&
    toId(candidate.id || candidate._id || candidate.contactId),
  ) || null;
};

const errorMetadata = (error) => ({
  code: error?.code || null,
  status: error?.upstreamStatus || error?.statusCode || error?.response?.status || null,
});

async function actualizarCedulaContactoDesdeMensaje(
  { phone, message, isFromMe, upsertResponse },
  dependencies = {},
) {
  if (isFromMe !== false) return { status: "ignored_sender" };

  const cedula = detectarCedulaEcuatoriana(message);
  if (!cedula) return { status: "no_valid_cedula" };

  const logger = dependencies.logger || console;

  if (!phone) {
    logger.warn("Contacto GHL no encontrado para la cedula detectada.");
    return { status: "contact_not_found", cedula };
  }

  try {
    const configFactory = dependencies.getGhlConfig || getGhlConfig;
    const clientFactory = dependencies.createGhlClient || createGhlClient;
    const executeRequest = dependencies.requestGhl || requestGhl;
    const config = configFactory({ requirePipelineId: false });
    const client = dependencies.client || clientFactory({
      ...config,
      apiVersion: process.env.GHL_CONTACTS_API_VERSION || CONTACTS_API_VERSION,
    });

    let contact = extraerContactoDesdeUpsert(upsertResponse);
    let contactId = toId(contact?.id || contact?._id || contact?.contactId);

    // El contacto recien creado por /contacts/upsert puede tardar unos instantes
    // en aparecer en /contacts/search. Se usa primero el ID devuelto por el upsert
    // y se conserva la busqueda por telefono para eventos o respuestas antiguas.
    if (!contactId) {
      const contactsPayload = await executeRequest(client, {
        method: "POST",
        url: "/contacts/search",
        retryOn5xx: true,
        data: {
          locationId: config.locationId,
          page: 1,
          pageLimit: 20,
          filters: [
            {
              field: "phone",
              operator: "eq",
              value: phone,
            },
          ],
        },
      });
      contact = encontrarContactoExacto(extractContacts(contactsPayload), phone);
      contactId = toId(contact?.id || contact?._id);
    }

    if (!contactId) {
      logger.warn("Contacto GHL no encontrado para la cedula detectada.");
      return { status: "contact_not_found", cedula };
    }

    const definitionsPayload = await executeRequest(client, {
      method: "GET",
      url: `/locations/${encodeURIComponent(config.locationId)}/customFields`,
      params: { model: "contact" },
      retryOn5xx: true,
    });
    const fieldDefinition = encontrarCampoCedula(
      extraerDefinicionesCampos(definitionsPayload),
    );
    const customFieldId = toId(
      fieldDefinition?.id || fieldDefinition?._id || fieldDefinition?.customFieldId,
    );

    if (!customFieldId) {
      logger.warn("Campo personalizado GHL no configurado.", {
        fieldKey: CEDULA_FIELD_KEY,
      });
      return { status: "custom_field_not_configured", cedula };
    }

    const currentCedula = obtenerValorCampoContacto(contact, customFieldId);
    const currentName = String(contact.name || "").trim();
    if (currentCedula === cedula && currentName === cedula) {
      return { status: "unchanged", cedula, contactId };
    }

    await executeRequest(client, {
      method: "PUT",
      url: `/contacts/${encodeURIComponent(contactId)}`,
      retryOn5xx: true,
      data: {
        name: cedula,
        customFields: [
          {
            id: customFieldId,
            fieldValue: cedula,
          },
        ],
      },
    });

    logger.info("Cedula detectada y guardada correctamente en GHL.", { cedula });
    return { status: "updated", cedula, contactId };
  } catch (error) {
    logger.error("Error al actualizar el contacto en GHL.", errorMetadata(error));
    return { status: "error", cedula };
  }
}

module.exports = {
  CEDULA_FIELD_KEY,
  actualizarCedulaContactoDesdeMensaje,
  detectarCedulaEcuatoriana,
  encontrarCampoCedula,
  esCedulaEcuatorianaValida,
  extraerContactoDesdeUpsert,
  normalizarPosibleCedula,
  obtenerValorCampoContacto,
};
