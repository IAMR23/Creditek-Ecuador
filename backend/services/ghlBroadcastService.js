const {
  createGhlClient,
  extractContacts,
  fetchContactsByIdsInBatches,
  getGhlConfig,
  requestGhl,
  toId,
} = require("./ghlService");

const CONTACTS_VERSION = process.env.GHL_CONTACTS_API_VERSION || "2021-07-28";
const MESSAGE_HUB_VERSION = "v3";
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const MAX_RECIPIENTS = 100;
const MAX_INSTANCES = 20;
const MAX_MESSAGE_LENGTH = 4000;
const INSTANCE_MARKER_PATTERN = /\{\s*WA#\d+\s*\}/i;

const compactString = (value) => String(value || "").trim();

const createError = (message, code, statusCode = 400) => {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
};

const normalizeName = (value) =>
  compactString(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const contactName = (contact) =>
  compactString(
    contact?.contactName ||
      contact?.name ||
      [contact?.firstName, contact?.lastName].filter(Boolean).join(" ") ||
      contact?.phone ||
      contact?.email ||
      "Cliente sin nombre",
  );

const isEnabledDndValue = (value) => {
  if (value === true) return true;
  if (!value || typeof value !== "object") return false;
  const status = normalizeName(value.status || value.state || value.value);
  return value.enabled === true || value.active === true || ["active", "enabled", "on"].includes(status);
};

const getDndReason = (contact) => {
  if (contact?.dnd === true) return "El contacto tiene No molestar activado";

  const settings = contact?.dndSettings;
  if (!settings || typeof settings !== "object") return "";

  const blockedChannel = Object.entries(settings).find(([channel, value]) => {
    const normalizedChannel = normalizeName(channel);
    return (
      (normalizedChannel.includes("sms") || normalizedChannel.includes("whatsapp")) &&
      isEnabledDndValue(value)
    );
  });

  return blockedChannel ? `El canal ${blockedChannel[0]} tiene No molestar activado` : "";
};

const formatContact = (contact) => {
  const phone = compactString(contact?.phone);
  const dndReason = getDndReason(contact);
  const reason = !phone ? "El contacto no tiene telefono" : dndReason;

  return {
    id: toId(contact?.id || contact?._id),
    name: contactName(contact),
    phone,
    email: compactString(contact?.email),
    source: compactString(contact?.source),
    tags: Array.isArray(contact?.tags) ? contact.tags.map(compactString).filter(Boolean) : [],
    dateAdded: contact?.dateAdded || null,
    canSend: !reason,
    blockedReason: reason || null,
  };
};

const parsePositiveInteger = (value, fallback, maximum) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, maximum);
};

const normalizeAdvancedFilters = (filters) => {
  if (!Array.isArray(filters)) return [];

  const allowedFields = new Set([
    "source",
    "tags",
    "firstName",
    "lastName",
    "email",
    "phone",
  ]);
  const allowedOperators = new Set(["eq", "not_eq", "contains", "not_contains"]);
  return filters.slice(0, 10).flatMap((filter) => {
    const field = compactString(filter?.field);
    const operator = compactString(filter?.operator).toLowerCase();
    const value = compactString(filter?.value).slice(0, 150);
    if (!allowedFields.has(field) || !allowedOperators.has(operator) || !value) return [];
    return [{ field, operator, value }];
  });
};

const normalizeContactIds = (contactIds) => {
  if (!Array.isArray(contactIds)) {
    throw createError("Debe seleccionar al menos un cliente", "GHL_BROADCAST_CONTACTS_REQUIRED");
  }

  const unique = [...new Set(contactIds.map(toId).filter(Boolean))];
  if (!unique.length) {
    throw createError("Debe seleccionar al menos un cliente", "GHL_BROADCAST_CONTACTS_REQUIRED");
  }
  if (unique.length > MAX_RECIPIENTS) {
    throw createError(
      `La difusion admite hasta ${MAX_RECIPIENTS} clientes por envio`,
      "GHL_BROADCAST_CONTACT_LIMIT",
    );
  }
  return unique;
};

const normalizeInstanceIndexes = (instanceIndexes) => {
  if (!Array.isArray(instanceIndexes)) {
    throw createError("Debe seleccionar al menos un numero de salida", "GHL_BROADCAST_INSTANCES_REQUIRED");
  }

  const unique = [
    ...new Set(
      instanceIndexes
        .map((value) => Number.parseInt(value, 10))
        .filter((value) => Number.isInteger(value) && value >= 1 && value <= MAX_INSTANCES),
    ),
  ].sort((left, right) => left - right);

  if (!unique.length) {
    throw createError("Debe seleccionar al menos un numero de salida", "GHL_BROADCAST_INSTANCES_REQUIRED");
  }
  return unique;
};

const validateMessage = (value) => {
  const message = compactString(value);
  if (!message) throw createError("Escriba el texto de la difusion", "GHL_BROADCAST_MESSAGE_REQUIRED");
  if (message.length > MAX_MESSAGE_LENGTH) {
    throw createError(
      `El mensaje no puede superar ${MAX_MESSAGE_LENGTH} caracteres`,
      "GHL_BROADCAST_MESSAGE_TOO_LONG",
    );
  }
  if (INSTANCE_MARKER_PATTERN.test(message)) {
    throw createError(
      "No incluya manualmente etiquetas { WA#N }; el sistema asigna cada numero",
      "GHL_BROADCAST_INSTANCE_MARKER_NOT_ALLOWED",
    );
  }
  return message;
};

const buildBalancedDistribution = (contacts, instanceIndexes) => {
  const instances = normalizeInstanceIndexes(instanceIndexes);
  const base = Math.floor(contacts.length / instances.length);
  const remainder = contacts.length % instances.length;
  let cursor = 0;

  return instances.map((instanceIndex, position) => {
    const quantity = base + (position < remainder ? 1 : 0);
    const assignedContacts = contacts.slice(cursor, cursor + quantity);
    cursor += quantity;
    return {
      instanceIndex,
      marker: `{ WA#${instanceIndex} }`,
      count: assignedContacts.length,
      contacts: assignedContacts,
    };
  });
};

const listContacts = async ({ query = "", page = 1, pageSize = DEFAULT_PAGE_SIZE, filters = [] } = {}, dependencies = {}) => {
  const configFactory = dependencies.getGhlConfig || getGhlConfig;
  const clientFactory = dependencies.createGhlClient || createGhlClient;
  const executeRequest = dependencies.requestGhl || requestGhl;
  const config = configFactory({ requirePipelineId: false });
  const client = clientFactory(config);
  const normalizedPage = parsePositiveInteger(page, 1, 100000);
  const normalizedPageSize = parsePositiveInteger(pageSize, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const normalizedQuery = compactString(query).slice(0, 75);
  const normalizedFilters = normalizeAdvancedFilters(filters);

  const payload = await executeRequest(client, {
    method: "POST",
    url: "/contacts/search",
    headers: { Version: CONTACTS_VERSION, "Content-Type": "application/json" },
    data: {
      locationId: config.locationId,
      page: normalizedPage,
      pageLimit: normalizedPageSize,
      ...(normalizedQuery ? { query: normalizedQuery } : {}),
      ...(normalizedFilters.length ? { filters: normalizedFilters } : {}),
    },
    maxRetries: 2,
  });

  const contacts = extractContacts(payload).map(formatContact).filter((contact) => contact.id);
  const total = Number(payload?.total ?? payload?.data?.total ?? contacts.length);

  return {
    contacts,
    pagination: {
      page: normalizedPage,
      pageSize: normalizedPageSize,
      total: Number.isFinite(total) ? total : contacts.length,
      totalPages: Math.max(1, Math.ceil((Number.isFinite(total) ? total : contacts.length) / normalizedPageSize)),
    },
  };
};

const getSmsProviders = async (client, config, executeRequest = requestGhl) => {
  const payload = await executeRequest(client, {
    method: "GET",
    url: `/locations/${encodeURIComponent(config.locationId)}/conversationChannels/SMS`,
    headers: { Version: MESSAGE_HUB_VERSION },
    maxRetries: 2,
  });
  const rows = payload?.conversationChannel?.SMS || payload?.data?.conversationChannel?.SMS || [];
  return Array.isArray(rows)
    ? rows.map((row) => row?.conversationProvider || row).filter(Boolean)
    : [];
};

const selectMessageHubProvider = (providers = []) => {
  const configuredName = normalizeName(process.env.GHL_MESSAGE_HUB_PROVIDER_NAME || "Whatsapp");
  const exact = providers.find((provider) => normalizeName(provider?.name) === configuredName);
  if (exact) return exact;
  return providers.find((provider) => {
    const name = normalizeName(provider?.name);
    return name.includes("whatsapp") || name.includes("message hub") || name.includes("messagesync");
  }) || null;
};

const getMessageHubProvider = async (dependencies = {}) => {
  const configFactory = dependencies.getGhlConfig || getGhlConfig;
  const clientFactory = dependencies.createGhlClient || createGhlClient;
  const executeRequest = dependencies.requestGhl || requestGhl;
  const config = configFactory({ requirePipelineId: false });
  const client = clientFactory(config);
  const providers = await getSmsProviders(client, config, executeRequest);
  const provider = selectMessageHubProvider(providers);

  if (!provider || !toId(provider._id || provider.id)) {
    throw createError(
      "Message Hub no esta configurado como proveedor de conversaciones en GHL",
      "GHL_MESSAGE_HUB_PROVIDER_NOT_FOUND",
      409,
    );
  }

  return { client, config, provider };
};

const getMessageHubStatus = async (dependencies = {}) => {
  const { provider } = await getMessageHubProvider(dependencies);
  return {
    configured: true,
    providerName: compactString(provider.name) || "Message Hub",
    instanceSlots: [1, 2, 3, 4, 5],
  };
};

const listLocationTags = async (dependencies = {}) => {
  const configFactory = dependencies.getGhlConfig || getGhlConfig;
  const clientFactory = dependencies.createGhlClient || createGhlClient;
  const executeRequest = dependencies.requestGhl || requestGhl;
  const config = configFactory({ requirePipelineId: false });
  const client = clientFactory(config);
  const payload = await executeRequest(client, {
    method: "GET",
    url: `/locations/${encodeURIComponent(config.locationId)}/tags`,
    headers: { Version: MESSAGE_HUB_VERSION },
    maxRetries: 2,
  });
  const rows = payload?.tags || payload?.data?.tags || [];
  if (!Array.isArray(rows)) return [];

  return rows
    .map((tag) => ({
      id: toId(tag?.id || tag?._id),
      name: compactString(tag?.name),
    }))
    .filter((tag) => tag.id && tag.name)
    .sort((left, right) => left.name.localeCompare(right.name, "es", { sensitivity: "base" }));
};

const loadSelectedContacts = async (contactIds, dependencies = {}) => {
  const normalizedIds = normalizeContactIds(contactIds);
  const configFactory = dependencies.getGhlConfig || getGhlConfig;
  const clientFactory = dependencies.createGhlClient || createGhlClient;
  const fetchByIds = dependencies.fetchContactsByIdsInBatches || fetchContactsByIdsInBatches;
  const config = configFactory({ requirePipelineId: false });
  const client = clientFactory(config);
  const contactsById = await fetchByIds({
    client,
    locationId: config.locationId,
    contactIds: normalizedIds,
  });

  const found = normalizedIds
    .map((id) => contactsById.get(id))
    .filter(Boolean)
    .map(formatContact);
  const foundIds = new Set(found.map((contact) => contact.id));
  const missing = normalizedIds
    .filter((id) => !foundIds.has(id))
    .map((id) => ({ id, name: "Contacto no encontrado", canSend: false, blockedReason: "El contacto ya no existe en GHL" }));
  const all = [...found, ...missing];

  return {
    eligible: all.filter((contact) => contact.canSend),
    excluded: all.filter((contact) => !contact.canSend),
  };
};

const previewBroadcast = async ({ contactIds, instanceIndexes, message }, dependencies = {}) => {
  const cleanMessage = validateMessage(message);
  const instances = normalizeInstanceIndexes(instanceIndexes);
  const { eligible, excluded } = await loadSelectedContacts(contactIds, dependencies);

  if (!eligible.length) {
    throw createError(
      "Ninguno de los clientes seleccionados tiene un telefono habilitado para el envio",
      "GHL_BROADCAST_NO_ELIGIBLE_CONTACTS",
    );
  }

  return {
    messageLength: cleanMessage.length,
    totalSelected: eligible.length + excluded.length,
    totalEligible: eligible.length,
    totalExcluded: excluded.length,
    excluded,
    distribution: buildBalancedDistribution(eligible, instances),
  };
};

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const sendBroadcast = async (input, dependencies = {}) => {
  if (input?.confirmation !== "ENVIAR") {
    throw createError("La difusion requiere confirmacion explicita", "GHL_BROADCAST_CONFIRMATION_REQUIRED");
  }

  const executeRequest = dependencies.requestGhl || requestGhl;
  const preview = await previewBroadcast(input, dependencies);
  const { client, provider } = await getMessageHubProvider(dependencies);
  const providerId = toId(provider._id || provider.id);
  const cleanMessage = validateMessage(input.message);
  const requestedInterval = Number(process.env.GHL_BROADCAST_INTERVAL_MS ?? 750);
  const intervalMs = Number.isFinite(requestedInterval)
    ? Math.min(10000, Math.max(0, requestedInterval))
    : 750;
  const results = [];

  for (const group of preview.distribution) {
    for (const contact of group.contacts) {
      try {
        const payload = await executeRequest(client, {
          method: "POST",
          url: "/conversations/messages",
          headers: { Version: MESSAGE_HUB_VERSION, "Content-Type": "application/json" },
          data: {
            // Message Hub esta registrado en GHL como proveedor SMS adicional.
            // GHL identifica internamente sus mensajes como TYPE_CUSTOM_SMS, pero
            // el endpoint publico exige type=SMS junto al conversationProviderId.
            type: "SMS",
            contactId: contact.id,
            conversationProviderId: providerId,
            message: `${cleanMessage}\n\n${group.marker}`,
          },
          maxRetries: 0,
        });
        results.push({
          contactId: contact.id,
          name: contact.name,
          instanceIndex: group.instanceIndex,
          status: "sent",
          messageId: toId(payload?.messageId || payload?.data?.messageId) || null,
        });
      } catch (error) {
        results.push({
          contactId: contact.id,
          name: contact.name,
          instanceIndex: group.instanceIndex,
          status: "failed",
          code: error.code || "GHL_BROADCAST_SEND_ERROR",
          message: error.message || "No se pudo enviar el mensaje",
        });
      }

      if (intervalMs > 0) await wait(intervalMs);
    }
  }

  const sent = results.filter((result) => result.status === "sent").length;
  const failed = results.length - sent;
  return {
    status: failed ? (sent ? "partial" : "failed") : "completed",
    total: results.length,
    sent,
    failed,
    excluded: preview.excluded,
    distribution: preview.distribution.map(({ instanceIndex, marker, count }) => ({ instanceIndex, marker, count })),
    results,
  };
};

module.exports = {
  MAX_RECIPIENTS,
  buildBalancedDistribution,
  formatContact,
  getMessageHubStatus,
  getMessageHubProvider,
  listLocationTags,
  listContacts,
  normalizeAdvancedFilters,
  normalizeInstanceIndexes,
  previewBroadcast,
  selectMessageHubProvider,
  sendBroadcast,
  validateMessage,
};
