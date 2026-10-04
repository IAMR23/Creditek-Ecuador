const {
  createGhlClient,
  extractContacts,
  fetchOpportunitiesByStatus,
  fetchContactsByIdsInBatches,
  fetchPipelines,
  getOpportunityContactId,
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
const MAX_MESSAGE_VARIANTS = 10;
const MAX_CONTACT_SEARCH_PAGES = 100;
const DEFAULT_CONTACT_SEARCH_CONCURRENCY = 3;
const MAX_CONTACT_SEARCH_CONCURRENCY = 5;
const DEFAULT_EXTERNAL_CONTACT_CONCURRENCY = 3;
const MAX_EXTERNAL_CONTACT_CONCURRENCY = 5;
const DEFAULT_PIPELINE_DATE_CACHE_TTL_MS = 30000;
const MAX_PIPELINE_DATE_CACHE_TTL_MS = 300000;
const MAX_PIPELINE_DATE_CACHE_ENTRIES = 10;
const INSTANCE_MARKER_PATTERN = /\{\s*WA#\d+\s*\}/i;
const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const pipelineDateContactsCache = new Map();

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

const parseNonNegativeInteger = (value, fallback, maximum) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0) return fallback;
  return Math.min(parsed, maximum);
};

const getContactSearchConcurrency = () => parsePositiveInteger(
  process.env.GHL_BROADCAST_SEARCH_CONCURRENCY,
  DEFAULT_CONTACT_SEARCH_CONCURRENCY,
  MAX_CONTACT_SEARCH_CONCURRENCY,
);

const getExternalContactConcurrency = () => parsePositiveInteger(
  process.env.GHL_BROADCAST_EXTERNAL_CONTACT_CONCURRENCY,
  DEFAULT_EXTERNAL_CONTACT_CONCURRENCY,
  MAX_EXTERNAL_CONTACT_CONCURRENCY,
);

const getPipelineDateCacheTtl = () => parseNonNegativeInteger(
  process.env.GHL_BROADCAST_LIST_CACHE_TTL_MS,
  DEFAULT_PIPELINE_DATE_CACHE_TTL_MS,
  MAX_PIPELINE_DATE_CACHE_TTL_MS,
);

const getCachedPipelineDateContacts = (key) => {
  const entry = pipelineDateContactsCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    pipelineDateContactsCache.delete(key);
    return null;
  }
  return entry.contacts;
};

const setCachedPipelineDateContacts = (key, contacts) => {
  const ttlMs = getPipelineDateCacheTtl();
  if (ttlMs <= 0) return;
  pipelineDateContactsCache.delete(key);
  pipelineDateContactsCache.set(key, {
    contacts,
    expiresAt: Date.now() + ttlMs,
  });
  while (pipelineDateContactsCache.size > MAX_PIPELINE_DATE_CACHE_ENTRIES) {
    const oldestKey = pipelineDateContactsCache.keys().next().value;
    pipelineDateContactsCache.delete(oldestKey);
  }
};

const parseEcuadorDateStart = (value) => {
  const match = compactString(value).match(DATE_ONLY_PATTERN);
  if (!match) return null;
  const [, year, month, day] = match.map(Number);
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  if (
    utcDate.getUTCFullYear() !== year
    || utcDate.getUTCMonth() !== month - 1
    || utcDate.getUTCDate() !== day
  ) return null;

  const date = new Date(`${value}T00:00:00.000-05:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const normalizeDateAddedFilterValue = (value) => {
  const from = parseEcuadorDateStart(value?.from);
  const to = parseEcuadorDateStart(value?.to);
  if (!from || !to || from > to) return null;

  // GHL usa limites estrictos gt/lt. Un milisegundo antes del inicio y el
  // inicio del dia posterior permiten incluir por completo ambas fechas.
  return {
    gt: new Date(from.getTime() - 1).toISOString(),
    lt: new Date(to.getTime() + 24 * 60 * 60 * 1000).toISOString(),
  };
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
    "pipelineStageId",
    "dateAdded",
  ]);
  const allowedOperators = new Set(["eq", "not_eq", "contains", "not_contains"]);
  return filters.slice(0, 10).flatMap((filter) => {
    const field = compactString(filter?.field);
    const operator = compactString(filter?.operator).toLowerCase();
    const pipelineId = compactString(filter?.pipelineId).slice(0, 150);
    if (!allowedFields.has(field)) return [];
    if (field === "dateAdded") {
      const value = operator === "range" ? normalizeDateAddedFilterValue(filter?.value) : null;
      return value ? [{ field, operator, value }] : [];
    }
    if (!allowedOperators.has(operator)) return [];

    const value = compactString(filter?.value).slice(0, 150);
    if (!value) return [];
    if (field === "pipelineStageId" && (operator !== "eq" || !pipelineId)) return [];
    return [{
      field,
      operator,
      value,
      ...(field === "pipelineStageId" ? { pipelineId } : {}),
    }];
  });
};

const searchContactsPage = async ({
  client,
  config,
  executeRequest,
  query,
  page,
  pageSize,
  filters,
}) => {
  const payload = await executeRequest(client, {
    method: "POST",
    url: "/contacts/search",
    headers: { Version: CONTACTS_VERSION, "Content-Type": "application/json" },
    data: {
      locationId: config.locationId,
      page,
      pageLimit: pageSize,
      ...(query ? { query } : {}),
      ...(filters.length ? { filters } : {}),
    },
    maxRetries: 2,
  });
  const contacts = extractContacts(payload).filter((contact) => toId(contact?.id || contact?._id));
  const rawTotal = Number(payload?.total ?? payload?.data?.total ?? contacts.length);
  return {
    contacts,
    total: Number.isFinite(rawTotal) ? rawTotal : contacts.length,
  };
};

const fetchDateFilteredContacts = async ({
  client,
  config,
  executeRequest,
  query,
  contactFilters,
}) => {
  const firstPage = await searchContactsPage({
    client,
    config,
    executeRequest,
    query,
    page: 1,
    pageSize: MAX_PAGE_SIZE,
    filters: contactFilters,
  });
  const totalPages = Math.max(1, Math.ceil(firstPage.total / MAX_PAGE_SIZE));
  if (totalPages > MAX_CONTACT_SEARCH_PAGES) {
    throw createError(
      "El rango de fechas devuelve demasiados contactos; seleccione un periodo mas corto",
      "GHL_BROADCAST_DATE_RANGE_TOO_BROAD",
      422,
    );
  }

  const pages = [firstPage.contacts];
  const concurrency = getContactSearchConcurrency();
  for (let firstPendingPage = 2; firstPendingPage <= totalPages; firstPendingPage += concurrency) {
    const pageNumbers = Array.from(
      { length: Math.min(concurrency, totalPages - firstPendingPage + 1) },
      (_, index) => firstPendingPage + index,
    );
    const pageResults = await Promise.all(pageNumbers.map((searchPage) => searchContactsPage({
      client,
      config,
      executeRequest,
      query,
      page: searchPage,
      pageSize: MAX_PAGE_SIZE,
      filters: contactFilters,
    })));
    pages.push(...pageResults.map((result) => result.contacts));
  }

  const contacts = [];
  const seen = new Set();
  pages.flat().forEach((contact) => {
    const contactId = toId(contact?.id || contact?._id);
    if (!contactId || seen.has(contactId)) return;
    seen.add(contactId);
    contacts.push(contact);
  });
  return contacts;
};

const paginatePipelineContacts = (matched, page, pageSize) => {
  const pageContacts = matched.slice((page - 1) * pageSize, page * pageSize);
  return {
    contacts: pageContacts,
    pagination: {
      page,
      pageSize,
      total: matched.length,
      totalPages: Math.max(1, Math.ceil(matched.length / pageSize)),
    },
  };
};

const matchesTextFilter = (actualValue, filter) => {
  const actual = normalizeName(actualValue);
  const expected = normalizeName(filter.value);
  if (filter.operator === "eq") return actual === expected;
  if (filter.operator === "not_eq") return actual !== expected;
  if (filter.operator === "contains") return actual.includes(expected);
  return !actual.includes(expected);
};

const matchesContactFilter = (contact, filter) => {
  if (filter.field !== "tags") return matchesTextFilter(contact?.[filter.field], filter);
  const tags = Array.isArray(contact?.tags) ? contact.tags : [];
  const positive = tags.some((tag) => matchesTextFilter(tag, {
    ...filter,
    operator: filter.operator === "not_eq"
      ? "eq"
      : filter.operator === "not_contains" ? "contains" : filter.operator,
  }));
  return filter.operator === "not_eq" || filter.operator === "not_contains" ? !positive : positive;
};

const matchesContactQuery = (contact, query) => {
  const expected = normalizeName(query);
  if (!expected) return true;
  return [
    contact?.contactName,
    contact?.name,
    contact?.firstName,
    contact?.lastName,
    contact?.email,
    contact?.phone,
  ].some((value) => normalizeName(value).includes(expected));
};

const listPipelineStageContacts = async ({
  client,
  config,
  query,
  page,
  pageSize,
  stageFilter,
  contactFilters,
  dependencies,
  cacheEnabled,
}) => {
  const opportunityLoader = dependencies.fetchOpportunitiesByStatus || fetchOpportunitiesByStatus;
  const contactLoader = dependencies.fetchContactsByIdsInBatches || fetchContactsByIdsInBatches;
  const executeRequest = dependencies.requestGhl || requestGhl;
  const hasDateFilter = contactFilters.some((filter) => filter.field === "dateAdded");
  const cacheKey = hasDateFilter ? JSON.stringify({
    locationId: config.locationId,
    pipelineId: stageFilter.pipelineId,
    pipelineStageId: stageFilter.value,
    query,
    filters: contactFilters,
  }) : "";
  if (cacheEnabled && cacheKey) {
    const cachedContacts = getCachedPipelineDateContacts(cacheKey);
    if (cachedContacts) return paginatePipelineContacts(cachedContacts, page, pageSize);
  }

  const opportunitiesPromise = opportunityLoader(
    client,
    {
      ...config,
      pipelineId: stageFilter.pipelineId,
      pipelineStageId: stageFilter.value,
    },
    "",
  );
  const dateContactsPromise = hasDateFilter
    ? fetchDateFilteredContacts({
      client,
      config,
      executeRequest,
      query,
      contactFilters,
    })
    : null;
  const [opportunities, dateContacts] = hasDateFilter
    ? await Promise.all([opportunitiesPromise, dateContactsPromise])
    : [await opportunitiesPromise, null];
  const embeddedContacts = new Map();
  const contactIds = [];
  const seenContactIds = new Set();

  opportunities.forEach((opportunity) => {
    const contactId = getOpportunityContactId(opportunity);
    if (!contactId || seenContactIds.has(contactId)) return;
    seenContactIds.add(contactId);
    contactIds.push(contactId);
    const embedded = opportunity?.contact || opportunity?.contactDetails;
    if (embedded || opportunity?.source) {
      embeddedContacts.set(contactId, {
        ...(embedded || {}),
        id: contactId,
        source: embedded?.source || opportunity.source,
      });
    }
  });

  if (hasDateFilter) {
    const stageContactIds = new Set(contactIds);
    const matched = dateContacts.flatMap((contact) => {
      const contactId = toId(contact?.id || contact?._id);
      if (!stageContactIds.has(contactId)) return [];
      const embedded = embeddedContacts.get(contactId);
      return [formatContact({
        ...embedded,
        ...contact,
        source: contact.source || embedded?.source,
      })];
    });
    if (cacheEnabled && cacheKey) setCachedPipelineDateContacts(cacheKey, matched);
    return paginatePipelineContacts(matched, page, pageSize);
  }

  const requiresFullFiltering = Boolean(query || contactFilters.length);
  const idsToLoad = requiresFullFiltering
    ? contactIds
    : contactIds.slice((page - 1) * pageSize, page * pageSize);
  const loadedContacts = idsToLoad.length
    ? await contactLoader({ client, locationId: config.locationId, contactIds: idsToLoad })
    : new Map();
  const resolveContact = (contactId) => {
    const loaded = loadedContacts.get(contactId);
    const embedded = embeddedContacts.get(contactId);
    return loaded
      ? { ...embedded, ...loaded, source: loaded.source || embedded?.source }
      : embedded;
  };

  if (!requiresFullFiltering) {
    return {
      contacts: idsToLoad.map(resolveContact).filter(Boolean).map(formatContact),
      pagination: {
        page,
        pageSize,
        total: contactIds.length,
        totalPages: Math.max(1, Math.ceil(contactIds.length / pageSize)),
      },
    };
  }

  const matched = contactIds
    .map(resolveContact)
    .filter(Boolean)
    .filter((contact) => matchesContactQuery(contact, query))
    .filter((contact) => contactFilters.every((filter) => matchesContactFilter(contact, filter)));
  const pageContacts = matched.slice((page - 1) * pageSize, page * pageSize);
  return {
    contacts: pageContacts.map(formatContact),
    pagination: {
      page,
      pageSize,
      total: matched.length,
      totalPages: Math.max(1, Math.ceil(matched.length / pageSize)),
    },
  };
};

const normalizeContactIds = (contactIds, { required = true } = {}) => {
  if (!Array.isArray(contactIds)) {
    if (!required && contactIds == null) return [];
    throw createError("Debe seleccionar al menos un cliente", "GHL_BROADCAST_CONTACTS_REQUIRED");
  }

  const unique = [...new Set(contactIds.map(toId).filter(Boolean))];
  if (required && !unique.length) {
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

const normalizeEcuadorMobilePhone = (value) => {
  const digits = compactString(value).replace(/\D/g, "");
  if (/^09\d{8}$/.test(digits)) return `+593${digits.slice(1)}`;
  if (/^5939\d{8}$/.test(digits)) return `+${digits}`;
  // Algunas exportaciones anteponen un 9 adicional al formato internacional.
  if (/^59399\d{8}$/.test(digits)) return `+593${digits.slice(4)}`;
  if (/^9\d{8}$/.test(digits)) return `+593${digits}`;
  return "";
};

const normalizeExternalPhoneNumbers = (phoneNumbers) => {
  if (phoneNumbers == null) return [];
  if (!Array.isArray(phoneNumbers)) {
    throw createError(
      "Los numeros cargados deben enviarse como una lista",
      "GHL_BROADCAST_EXTERNAL_PHONES_INVALID",
    );
  }

  const normalized = phoneNumbers.map(normalizeEcuadorMobilePhone);
  const invalidCount = normalized.filter((phone) => !phone).length;
  if (invalidCount) {
    throw createError(
      `${invalidCount} numero${invalidCount === 1 ? "" : "s"} no tiene formato movil de Ecuador (09...)`,
      "GHL_BROADCAST_EXTERNAL_PHONES_INVALID",
    );
  }

  const unique = [...new Set(normalized)];
  if (unique.length > MAX_RECIPIENTS) {
    throw createError(
      `La difusion admite hasta ${MAX_RECIPIENTS} destinatarios por envio`,
      "GHL_BROADCAST_CONTACT_LIMIT",
    );
  }
  return unique;
};

const validateRecipientLimit = (contactIds, phoneNumbers) => {
  if (!contactIds.length && !phoneNumbers.length) {
    throw createError(
      "Debe seleccionar clientes o cargar al menos un numero",
      "GHL_BROADCAST_CONTACTS_REQUIRED",
    );
  }
  if (contactIds.length + phoneNumbers.length > MAX_RECIPIENTS) {
    throw createError(
      `La difusion admite hasta ${MAX_RECIPIENTS} destinatarios por envio`,
      "GHL_BROADCAST_CONTACT_LIMIT",
    );
  }
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

const normalizeMessages = (input = {}) => {
  const source = Array.isArray(input.messages) ? input.messages : [input.message];
  if (!source.length) {
    throw createError("Escriba al menos un mensaje para la difusion", "GHL_BROADCAST_MESSAGE_REQUIRED");
  }
  if (source.length > MAX_MESSAGE_VARIANTS) {
    throw createError(
      `La difusion admite hasta ${MAX_MESSAGE_VARIANTS} mensajes alternados`,
      "GHL_BROADCAST_MESSAGE_VARIANT_LIMIT",
    );
  }
  return source.map(validateMessage);
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

  const stageFilter = normalizedFilters.find((filter) => filter.field === "pipelineStageId");
  if (stageFilter) {
    return listPipelineStageContacts({
      client,
      config,
      query: normalizedQuery,
      page: normalizedPage,
      pageSize: normalizedPageSize,
      stageFilter,
      contactFilters: normalizedFilters.filter((filter) => filter !== stageFilter),
      dependencies,
      cacheEnabled: dependencies.enablePipelineDateCache
        ?? Object.keys(dependencies).length === 0,
    });
  }

  const result = await searchContactsPage({
    client,
    config,
    executeRequest,
    query: normalizedQuery,
    page: normalizedPage,
    pageSize: normalizedPageSize,
    filters: normalizedFilters,
  });
  const contacts = result.contacts.map(formatContact).filter((contact) => contact.id);

  return {
    contacts,
    pagination: {
      page: normalizedPage,
      pageSize: normalizedPageSize,
      total: result.total,
      totalPages: Math.max(1, Math.ceil(result.total / normalizedPageSize)),
    },
  };
};

const listPipelines = async (dependencies = {}) => {
  const configFactory = dependencies.getGhlConfig || getGhlConfig;
  const clientFactory = dependencies.createGhlClient || createGhlClient;
  const pipelineLoader = dependencies.fetchPipelines || fetchPipelines;
  const config = configFactory({ requirePipelineId: false });
  const client = clientFactory(config);
  const pipelines = await pipelineLoader(client, config);
  return pipelines.map((pipeline) => ({
    id: toId(pipeline?.id || pipeline?._id),
    name: compactString(pipeline?.name || pipeline?.title) || "Pipeline sin nombre",
    stages: (pipeline?.stages || pipeline?.pipelineStages || []).map((stage) => ({
      id: toId(stage?.id || stage?._id),
      name: compactString(stage?.name || stage?.title) || "Etapa sin nombre",
    })).filter((stage) => stage.id),
  })).filter((pipeline) => pipeline.id);
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
  const normalizedIds = normalizeContactIds(contactIds, { required: false });
  if (!normalizedIds.length) return { eligible: [], excluded: [] };

  const configFactory = dependencies.getGhlConfig || getGhlConfig;
  const clientFactory = dependencies.createGhlClient || createGhlClient;
  const fetchByIds = dependencies.fetchContactsByIdsInBatches || fetchContactsByIdsInBatches;
  const config = configFactory({ requirePipelineId: false });
  const client = clientFactory(config);
  const contactsById = dependencies.preloadedContacts instanceof Map
    ? new Map(dependencies.preloadedContacts)
    : new Map();
  const idsToLoad = normalizedIds.filter((id) => !contactsById.has(id));
  if (idsToLoad.length) {
    const loadedContacts = await fetchByIds({
      client,
      locationId: config.locationId,
      contactIds: idsToLoad,
    });
    loadedContacts.forEach((contact, id) => contactsById.set(id, contact));
  }

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

const extractUpsertedContact = (payload, phone) => {
  if (!payload || typeof payload !== "object" || payload.succeeded === false) return null;
  const contact = payload.contact || payload.data?.contact || payload.data;
  const contactId = toId(contact?.id || contact?._id || contact?.contactId || payload.contactId);
  if (!contactId) return null;
  return {
    contactId,
    contact: {
      ...(contact && typeof contact === "object" ? contact : {}),
      id: contactId,
      phone: compactString(contact?.phone) || phone,
    },
  };
};

const resolveExternalRecipients = async (input = {}, dependencies = {}) => {
  const contactIds = normalizeContactIds(input.contactIds, { required: false });
  const phoneNumbers = normalizeExternalPhoneNumbers(input.phoneNumbers);
  validateRecipientLimit(contactIds, phoneNumbers);
  if (!phoneNumbers.length) {
    return { ...input, contactIds, phoneNumbers: [], preloadedContacts: new Map() };
  }

  const configFactory = dependencies.getGhlConfig || getGhlConfig;
  const clientFactory = dependencies.createGhlClient || createGhlClient;
  const executeRequest = dependencies.requestGhl || requestGhl;
  const config = configFactory({ requirePipelineId: false });
  const client = dependencies.client || clientFactory(config);
  const resolved = [];
  const concurrency = getExternalContactConcurrency();

  for (let index = 0; index < phoneNumbers.length; index += concurrency) {
    const batch = phoneNumbers.slice(index, index + concurrency);
    const results = await Promise.all(batch.map(async (phone) => {
      try {
        const payload = await executeRequest(client, {
          method: "POST",
          url: "/contacts/upsert",
          headers: { Version: CONTACTS_VERSION, "Content-Type": "application/json" },
          data: {
            locationId: config.locationId,
            phone,
            country: "EC",
            createNewIfDuplicateAllowed: false,
          },
          maxRetries: 2,
        });
        const result = extractUpsertedContact(payload, phone);
        return result || { error: true };
      } catch (_error) {
        return { error: true };
      }
    }));
    resolved.push(...results);
  }

  const failed = resolved.filter((result) => result.error).length;
  if (failed) {
    throw createError(
      `No se pudieron preparar ${failed} numero${failed === 1 ? "" : "s"} en GHL`,
      "GHL_BROADCAST_EXTERNAL_CONTACT_RESOLUTION_FAILED",
      502,
    );
  }

  const preloadedContacts = new Map();
  resolved.forEach(({ contactId, contact }) => preloadedContacts.set(contactId, contact));
  const resolvedContactIds = [...new Set([
    ...contactIds,
    ...resolved.map(({ contactId }) => contactId),
  ])];
  if (resolvedContactIds.length > MAX_RECIPIENTS) {
    throw createError(
      `La difusion admite hasta ${MAX_RECIPIENTS} destinatarios por envio`,
      "GHL_BROADCAST_CONTACT_LIMIT",
    );
  }

  return {
    ...input,
    contactIds: resolvedContactIds,
    phoneNumbers: [],
    preloadedContacts,
  };
};

const previewBroadcast = async (input = {}, dependencies = {}) => {
  const cleanMessages = normalizeMessages(input);
  const contactIds = normalizeContactIds(input.contactIds, { required: false });
  const phoneNumbers = normalizeExternalPhoneNumbers(input.phoneNumbers);
  validateRecipientLimit(contactIds, phoneNumbers);
  const { instanceIndexes } = input;
  const instances = normalizeInstanceIndexes(instanceIndexes);
  const { eligible, excluded } = await loadSelectedContacts(contactIds, {
    ...dependencies,
    preloadedContacts: input.preloadedContacts || dependencies.preloadedContacts,
  });
  const selectedPhones = new Set(
    [...eligible, ...excluded].map((contact) => normalizeEcuadorMobilePhone(contact.phone)).filter(Boolean),
  );
  const externalContacts = phoneNumbers
    .filter((phone) => !selectedPhones.has(phone))
    .map((phone) => ({
      id: `external:${phone}`,
      name: `Numero externo 0${phone.slice(4)}`,
      phone,
      source: "Carga manual",
      tags: [],
      dateAdded: null,
      canSend: true,
      blockedReason: null,
      external: true,
    }));
  const allEligible = [...eligible, ...externalContacts];

  if (!allEligible.length) {
    throw createError(
      "Ninguno de los destinatarios tiene un telefono habilitado para el envio",
      "GHL_BROADCAST_NO_ELIGIBLE_CONTACTS",
    );
  }

  return {
    messageLength: cleanMessages[0].length,
    messageLengths: cleanMessages.map((message) => message.length),
    messageCount: cleanMessages.length,
    totalSelected: allEligible.length + excluded.length,
    totalEligible: allEligible.length,
    totalExcluded: excluded.length,
    excluded,
    distribution: buildBalancedDistribution(allEligible, instances),
  };
};

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const sendBroadcast = async (input, dependencies = {}) => {
  if (input?.confirmation !== "ENVIAR") {
    throw createError("La difusion requiere confirmacion explicita", "GHL_BROADCAST_CONFIRMATION_REQUIRED");
  }

  const executeRequest = dependencies.requestGhl || requestGhl;
  const resolvedInput = await resolveExternalRecipients(input, dependencies);
  const preview = await previewBroadcast(resolvedInput, dependencies);
  const { client, provider } = await getMessageHubProvider(dependencies);
  const providerId = toId(provider._id || provider.id);
  const cleanMessages = normalizeMessages(resolvedInput);
  const requestedInterval = Number(process.env.GHL_BROADCAST_INTERVAL_MS ?? 750);
  const intervalMs = Number.isFinite(requestedInterval)
    ? Math.min(10000, Math.max(0, requestedInterval))
    : 750;
  const results = [];

  for (const group of preview.distribution) {
    for (const contact of group.contacts) {
      const cleanMessage = cleanMessages[results.length % cleanMessages.length];
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
  MAX_MESSAGE_VARIANTS,
  MAX_RECIPIENTS,
  buildBalancedDistribution,
  formatContact,
  getMessageHubStatus,
  getMessageHubProvider,
  listLocationTags,
  listPipelines,
  listContacts,
  normalizeAdvancedFilters,
  normalizeEcuadorMobilePhone,
  normalizeExternalPhoneNumbers,
  normalizeInstanceIndexes,
  normalizeMessages,
  previewBroadcast,
  resolveExternalRecipients,
  selectMessageHubProvider,
  sendBroadcast,
  validateMessage,
};
