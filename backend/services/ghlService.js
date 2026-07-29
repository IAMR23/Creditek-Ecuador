const axios = require("axios");

const DEFAULT_GHL_BASE_URL = "https://services.leadconnectorhq.com";
const DEFAULT_GHL_API_VERSION = "2023-02-21";
const DEFAULT_LIMIT = 100;
const MAX_OPPORTUNITY_PAGES = 500;
const SIN_PROPIETARIO_ID = "sin-propietario";
const SIN_ETAPA_ID = "sin-etapa";
const SIN_SOURCE_ID = "Sin Source ID";
const PAUTAS_OPPORTUNITY_STATUSES = Object.freeze([
  "open",
  "won",
  "lost",
  "abandoned",
]);
const UNKNOWN_OPPORTUNITY_STATUS = "unknown";
const pautasDataCache = new Map();
const pautasInFlight = new Map();
const contactSourceIdCache = new Map();

const getNonNegativeEnvNumber = (name, fallback) => {
  const parsedValue = Number(process.env[name] ?? fallback);
  return Number.isFinite(parsedValue) && parsedValue >= 0
    ? parsedValue
    : fallback;
};

const getGhlConfig = ({ requirePipelineId = true } = {}) => {
  const config = {
    token: process.env.GHL_TOKEN,
    locationId: process.env.GHL_LOCATION_ID,
    pipelineId: process.env.GHL_PIPELINE_ID,
    companyId: process.env.GHL_COMPANY_ID,
    apiVersion: process.env.GHL_API_VERSION || DEFAULT_GHL_API_VERSION,
    baseUrl: (process.env.GHL_BASE_URL || DEFAULT_GHL_BASE_URL).replace(/\/+$/, ""),
  };

  const missing = [];
  if (!config.token) missing.push("GHL_TOKEN");
  if (!config.locationId) missing.push("GHL_LOCATION_ID");
  if (requirePipelineId && !config.pipelineId) missing.push("GHL_PIPELINE_ID");

  if (missing.length) {
    const error = new Error(`Falta configurar ${missing.join(", ")} en el .env`);
    error.statusCode = 500;
    error.code = "GHL_CONFIG_MISSING";
    throw error;
  }

  return config;
};

const createGhlClient = (config) =>
  axios.create({
    baseURL: config.baseUrl,
    timeout: Number(process.env.GHL_TIMEOUT_MS || 20000),
    headers: {
      Authorization: `Bearer ${config.token}`,
      Version: config.apiVersion,
      Accept: "application/json",
    },
  });

const getErrorMessageFromResponse = (data) => {
  if (!data) return "";
  if (typeof data === "string") return data;
  return (
    data.message ||
    data.error ||
    data.error_description ||
    data.msg ||
    (Array.isArray(data.errors) ? data.errors.map((item) => item.message || item).join(", ") : "")
  );
};

const getErrorMessages = (error) => {
  const message = error?.message;
  if (Array.isArray(message)) return message.map(String);
  if (!message) return [];
  return [String(message)];
};

const errorHasAnyMessage = (error, fragments = []) => {
  const messages = getErrorMessages(error).map((message) => message.toLowerCase());
  return fragments.some((fragment) =>
    messages.some((message) => message.includes(String(fragment).toLowerCase())),
  );
};

const normalizeGhlError = (error) => {
  if (!error.response) {
    const serviceError = new Error(
      error.code === "ECONNABORTED"
        ? "HighLevel no respondio a tiempo"
        : "No se pudo conectar con HighLevel"
    );
    serviceError.statusCode = 502;
    serviceError.code = "GHL_CONNECTION_ERROR";
    return serviceError;
  }

  const status = error.response.status;
  const upstreamMessage = getErrorMessageFromResponse(error.response.data);
  const serviceError = new Error("Error consultando HighLevel");
  serviceError.upstreamStatus = status;
  serviceError.upstreamData = error.response.data;
  const retryAfterHeader = error.response.headers?.["retry-after"];
  const retryAfterSeconds = Number(retryAfterHeader);
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0) {
    serviceError.retryAfterMs = retryAfterSeconds * 1000;
  }

  if (status === 401) {
    serviceError.message = "Token de HighLevel invalido o vencido";
    serviceError.statusCode = 401;
    serviceError.code = "GHL_UNAUTHORIZED";
    return serviceError;
  }

  if (status === 403) {
    serviceError.message = "El token de HighLevel no tiene permisos para esta informacion";
    serviceError.statusCode = 403;
    serviceError.code = "GHL_FORBIDDEN";
    return serviceError;
  }

  if (status === 429) {
    serviceError.message =
      "HighLevel alcanzo temporalmente su limite de consultas. Se reintentara con datos en cache.";
    serviceError.statusCode = 503;
    serviceError.code = "GHL_RATE_LIMITED";
    return serviceError;
  }

  if (status === 400 || status === 422) {
    serviceError.message =
      upstreamMessage || "HighLevel rechazo la solicitud. Revisa locationId, pipelineId y permisos.";
    serviceError.statusCode = 400;
    serviceError.code = "GHL_BAD_REQUEST";
    return serviceError;
  }

  serviceError.message = upstreamMessage || "HighLevel respondio con un error inesperado";
  serviceError.statusCode = 502;
  serviceError.code = "GHL_UPSTREAM_ERROR";
  return serviceError;
};

const requestGhl = async (client, options) => {
  try {
    const response = await client.request(options);
    return response.data || {};
  } catch (error) {
    throw normalizeGhlError(error);
  }
};

const requestGhlWithFallback = async (client, primaryOptions, fallbackOptions, shouldFallback) => {
  try {
    return await requestGhl(client, primaryOptions);
  } catch (error) {
    if (!fallbackOptions || !shouldFallback(error)) {
      throw error;
    }

    return requestGhl(client, fallbackOptions);
  }
};

const pickArray = (payload, keys = []) => {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];

  for (const key of keys) {
    if (Array.isArray(payload[key])) return payload[key];
    if (Array.isArray(payload.data?.[key])) return payload.data[key];
  }

  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.results)) return payload.results;
  if (Array.isArray(payload.items)) return payload.items;

  return [];
};

const toId = (value) => {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return toId(value[0]);
  if (typeof value === "object") {
    return toId(value.id || value._id || value.userId || value.stageId || value.value);
  }
  return String(value).trim();
};

const compact = (values) =>
  values
    .map((value) => String(value || "").trim())
    .filter(Boolean);

const getFullName = (entity) => {
  if (!entity || typeof entity !== "object") return "";

  const directName =
    entity.name ||
    entity.fullName ||
    entity.displayName ||
    entity.userName ||
    entity.email;

  if (directName) return String(directName).trim();

  return compact([entity.firstName, entity.lastName]).join(" ");
};

const normalizeKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const normalizeComparableText = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

const normalizeSourceIdValue = (value) => {
  if (value === null || value === undefined) return "";

  if (Array.isArray(value)) {
    return value.map(normalizeSourceIdValue).find(Boolean) || "";
  }

  if (typeof value === "object") {
    return normalizeSourceIdValue(
      value.field_value ?? value.fieldValue ?? value.value,
    );
  }

  return String(value).trim();
};

const extractOpportunities = (payload) =>
  pickArray(payload, ["opportunities", "opportunity", "data", "items"]);

const extractPipelines = (payload) =>
  pickArray(payload, ["pipelines", "pipeline", "data", "items"]);

const extractUsers = (payload) => pickArray(payload, ["users", "user", "data", "items"]);

const extractContacts = (payload) =>
  pickArray(payload, ["contacts", "contact", "data", "items"]);

const getPaginationMeta = (payload) =>
  payload?.meta || payload?._meta || payload?.pagination || payload?.data?.meta || {};

const extractStartAfterIdFromUrl = (nextPageUrl) => {
  if (!nextPageUrl) return "";

  try {
    const parsed = new URL(nextPageUrl, DEFAULT_GHL_BASE_URL);
    return parsed.searchParams.get("startAfterId") || "";
  } catch (error) {
    return "";
  }
};

const extractPaginationCursorFromUrl = (nextPageUrl) => {
  if (!nextPageUrl) {
    return {
      startAfterId: "",
      startAfter: "",
    };
  }

  try {
    const parsed = new URL(nextPageUrl, DEFAULT_GHL_BASE_URL);
    return {
      startAfterId: parsed.searchParams.get("startAfterId") || "",
      startAfter: parsed.searchParams.get("startAfter") || "",
    };
  } catch (error) {
    return {
      startAfterId: "",
      startAfter: "",
    };
  }
};

const getNextStartAfterId = (payload, currentPageItems, limit) => {
  const meta = getPaginationMeta(payload);
  const candidates = [
    meta.nextStartAfterId,
    payload?.nextStartAfterId,
    extractStartAfterIdFromUrl(meta.nextPageUrl || payload?.nextPageUrl),
    meta.startAfterId,
    payload?.startAfterId,
  ];

  const cursor = candidates.map(toId).find(Boolean);
  if (cursor) return cursor;

  if (currentPageItems.length >= limit) {
    return toId(currentPageItems[currentPageItems.length - 1]?.id);
  }

  return "";
};

const getNextPaginationCursor = (payload, currentPageItems, limit) => {
  const meta = getPaginationMeta(payload);
  const urlCursor = extractPaginationCursorFromUrl(meta.nextPageUrl || payload?.nextPageUrl);
  const startAfterId = toId(
    meta.startAfterId ||
      payload?.startAfterId ||
      meta.nextStartAfterId ||
      payload?.nextStartAfterId ||
      urlCursor.startAfterId ||
      (currentPageItems.length >= limit ? currentPageItems[currentPageItems.length - 1]?.id : "")
  );
  const startAfter = toId(meta.startAfter || payload?.startAfter || urlCursor.startAfter);

  if (!startAfterId) return null;

  return {
    startAfterId,
    startAfter,
  };
};

const hasExplicitNextPage = (payload) => {
  const meta = getPaginationMeta(payload);
  return Boolean(
    meta.nextPageUrl ||
      meta.nextStartAfterId ||
      payload?.nextPageUrl ||
      payload?.nextStartAfterId ||
      meta.hasMore === true ||
      payload?.hasMore === true
  );
};

const getOpportunityPipelineId = (opportunity) =>
  toId(opportunity?.pipelineId || opportunity?.pipeline?.id || opportunity?.pipeline?._id);

const getOpportunityStageId = (opportunity) =>
  toId(
    opportunity?.pipelineStageId ||
      opportunity?.stageId ||
      opportunity?.stage?.id ||
      opportunity?.pipelineStage?.id
  );

const getOpportunityDateValue = (opportunity) =>
  opportunity?.createdAt ||
  opportunity?.created_at ||
  opportunity?.dateAdded ||
  opportunity?.date_added ||
  opportunity?.dateCreated ||
  opportunity?.date_created ||
  opportunity?.updatedAt ||
  opportunity?.updated_at ||
  opportunity?.lastStatusChangeAt ||
  opportunity?.last_status_change_at;

const getTodayDateInTimeZone = (timeZone = "America/Guayaquil") => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(new Date())
    .reduce((acc, part) => {
      if (part.type !== "literal") acc[part.type] = part.value;
      return acc;
    }, {});

  return `${parts.year}-${parts.month}-${parts.day}`;
};

const resolveDateFilters = ({ fechaInicio, fechaFin } = {}) => {
  if (!fechaInicio && !fechaFin) {
    const today = getTodayDateInTimeZone();
    return {
      fechaInicio: today,
      fechaFin: today,
    };
  }

  return {
    fechaInicio,
    fechaFin,
  };
};

const parseDateBoundary = (value, endOfDay = false) => {
  if (!value) return null;
  const normalized = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    const time = endOfDay ? "23:59:59.999" : "00:00:00.000";
    const date = new Date(`${normalized}T${time}-05:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getOpportunityParsedDate = (opportunity) =>
  parseDateBoundary(getOpportunityDateValue(opportunity));

const filterOpportunitiesByDateRange = (opportunities = [], { fechaInicio, fechaFin } = {}) => {
  const startDate = parseDateBoundary(fechaInicio, false);
  const endDate = parseDateBoundary(fechaFin, true);

  if (!startDate && !endDate) return opportunities;

  return opportunities.filter((opportunity) => {
    const opportunityDate = getOpportunityParsedDate(opportunity);
    if (!opportunityDate) return false;
    if (startDate && opportunityDate < startDate) return false;
    if (endDate && opportunityDate > endDate) return false;
    return true;
  });
};

const shouldStopDatePagination = (opportunities = [], { fechaInicio } = {}) => {
  const startDate = parseDateBoundary(fechaInicio, false);
  if (!startDate || !opportunities.length) return false;

  const parsedDates = opportunities.map(getOpportunityParsedDate);
  if (parsedDates.some((date) => !date)) return false;

  return parsedDates.every((date) => date < startDate);
};

const getSelectedPipeline = (pipelines = [], pipelineId) => {
  const selected =
    pipelines.find((pipeline) => toId(pipeline?.id || pipeline?._id) === pipelineId) ||
    pipelines[0] ||
    null;

  return selected;
};

const getStageColumns = (pipelines = [], pipelineId) => {
  const selectedPipeline = getSelectedPipeline(pipelines, pipelineId);
  const stages = Array.isArray(selectedPipeline?.stages) ? selectedPipeline.stages : [];
  const seen = new Set();

  const columns = stages
    .map((stage) => {
      const stageName = getFullName(stage) || stage.title || stage.label || "Etapa sin nombre";
      const rawId = toId(stage?.id || stage?._id || stage?.stageId);
      const id = rawId || `stage-${normalizeKey(stageName)}`;

      return {
        id,
        name: String(stageName).trim(),
        pipelineStageId: rawId || null,
      };
    })
    .filter((stage) => {
      if (!stage.id || seen.has(stage.id)) return false;
      seen.add(stage.id);
      return true;
    });

  return {
    selectedPipeline,
    columns,
  };
};

const getOpportunityContactId = (opportunity = {}) => {
  const directContactId = toId(
    opportunity.contactId ||
      opportunity.contact_id ||
      opportunity.contact?.id ||
      opportunity.contact?._id ||
      opportunity.contact?.contactId ||
      opportunity.contact?.contact_id,
  );

  if (directContactId) return directContactId;

  const relations = Array.isArray(opportunity.relations) ? opportunity.relations : [];
  const contactRelation = relations.find((relation) => {
    const relationType = normalizeComparableText(
      relation?.type ||
        relation?.relationType ||
        relation?.model ||
        relation?.objectType,
    );
    return relationType.includes("contact");
  });

  return toId(
    contactRelation?.id ||
      contactRelation?._id ||
      contactRelation?.contactId ||
      contactRelation?.objectId,
  );
};

const getSourceFieldPriority = (identifier) => {
  const withoutContactPrefix = String(identifier || "")
    .trim()
    .replace(/^contact[._]/i, "");
  const lowerIdentifier = withoutContactPrefix.toLowerCase();

  if (lowerIdentifier === "meta_source_id") return 0;
  if (lowerIdentifier === "sourceid") return 1;
  if (lowerIdentifier === "source_id") return 2;
  if (normalizeComparableText(withoutContactPrefix) === "source id") return 3;

  return Number.POSITIVE_INFINITY;
};

const buildCustomFieldDefinitionMap = (definitions = []) => {
  const definitionMap = new Map();

  definitions.forEach((definition) => {
    const definitionId = toId(
      definition?.id || definition?._id || definition?.customFieldId,
    );
    if (definitionId) definitionMap.set(definitionId, definition);
  });

  return definitionMap;
};

const getCustomFieldValue = (field = {}) => {
  const candidates = [field.field_value, field.fieldValue, field.value];
  return candidates.map(normalizeSourceIdValue).find(Boolean) || "";
};

const collectSourceIdCandidates = (
  entity,
  customFieldDefinitionMap,
  candidates,
  orderRef,
) => {
  if (!entity || typeof entity !== "object") return;

  [
    ["meta_source_id", entity.meta_source_id],
    ["sourceId", entity.sourceId],
    ["source_id", entity.source_id],
  ].forEach(([identifier, value]) => {
    const normalizedValue = normalizeSourceIdValue(value);
    if (!normalizedValue) return;

    candidates.push({
      priority: getSourceFieldPriority(identifier),
      order: orderRef.value,
      value: normalizedValue,
    });
    orderRef.value += 1;
  });

  const customFields = Array.isArray(entity.customFields)
    ? entity.customFields
    : Array.isArray(entity.custom_fields)
      ? entity.custom_fields
      : [];

  customFields.forEach((field) => {
    const definition = customFieldDefinitionMap.get(
      toId(field?.id || field?._id || field?.customFieldId),
    );
    const identifiers = [
      field?.key,
      field?.fieldKey,
      field?.name,
      field?.label,
      definition?.key,
      definition?.fieldKey,
      definition?.name,
      definition?.label,
    ];
    const priority = Math.min(...identifiers.map(getSourceFieldPriority));
    const value = getCustomFieldValue(field);

    if (!Number.isFinite(priority) || !value) return;

    candidates.push({
      priority,
      order: orderRef.value,
      value,
    });
    orderRef.value += 1;
  });
};

const extractSourceIdFromEntities = (
  entities = [],
  customFieldDefinitions = [],
) => {
  const customFieldDefinitionMap =
    customFieldDefinitions instanceof Map
      ? customFieldDefinitions
      : buildCustomFieldDefinitionMap(customFieldDefinitions);
  const candidates = [];
  const orderRef = { value: 0 };

  entities.forEach((entity) => {
    collectSourceIdCandidates(
      entity,
      customFieldDefinitionMap,
      candidates,
      orderRef,
    );
  });

  candidates.sort(
    (first, second) =>
      first.priority - second.priority || first.order - second.order,
  );

  return candidates[0]?.value || "";
};

const extractSourceIdFromContact = (contact, customFieldDefinitions = []) =>
  extractSourceIdFromEntities([contact], customFieldDefinitions);

const extractSourceIdFromOpportunity = (
  opportunity,
  customFieldDefinitions = [],
) =>
  extractSourceIdFromEntities(
    [opportunity?.contact, opportunity],
    customFieldDefinitions,
  );

const dedupeOpportunitiesById = (opportunities = []) => {
  const seenOpportunityIds = new Set();

  return opportunities.filter((opportunity) => {
    const opportunityId = toId(opportunity?.id || opportunity?._id);
    if (!opportunityId) return true;
    if (seenOpportunityIds.has(opportunityId)) return false;
    seenOpportunityIds.add(opportunityId);
    return true;
  });
};

const getStageMetricGroup = (stageName) => {
  const normalizedStageName = normalizeComparableText(stageName);

  if (
    new Set(["aplica", "costa aplica", "oriente aplica"]).has(
      normalizedStageName,
    )
  ) {
    return "aplican";
  }

  if (
    new Set(["no aplica", "costa no aplica", "oriente no aplica"]).has(
      normalizedStageName,
    )
  ) {
    return "noAplican";
  }

  if (normalizedStageName === "no contesta") return "noContesta";

  return "otros";
};

const getOpportunityStatus = (opportunity) => {
  const statusCandidates = [
    opportunity?.status,
    opportunity?.opportunityStatus,
    opportunity?.state,
    opportunity?.statusName,
  ];

  for (const candidate of statusCandidates) {
    const normalizedStatus = String(candidate ?? "").trim().toLowerCase();
    if (normalizedStatus) return normalizedStatus;
  }

  return UNKNOWN_OPPORTUNITY_STATUS;
};

const roundPercentage = (value, total) => {
  if (!total) return 0;
  return Math.round((value / total) * 10000) / 100;
};

const buildUserMap = (users = []) => {
  const userMap = new Map();

  users.forEach((user) => {
    const ids = compact([user?.id, user?._id, user?.userId]);
    const name = getFullName(user);

    ids.forEach((id) => {
      userMap.set(id, name || `Usuario ${id}`);
    });
  });

  return userMap;
};

const resolveOwner = (opportunity, userMap) => {
  const assignedTo = opportunity?.assignedTo || opportunity?.userId || opportunity?.ownerId;
  const directName = getFullName(assignedTo);
  const ownerId = toId(assignedTo);

  if (!ownerId) {
    return {
      id: SIN_PROPIETARIO_ID,
      name: directName || "Sin propietario",
    };
  }

  return {
    id: ownerId,
    name: directName || userMap.get(ownerId) || "Propietario no encontrado",
  };
};

const buildOpportunitiesMatrix = ({
  opportunities = [],
  pipelines = [],
  users = [],
  pipelineId = "",
} = {}) => {
  const userMap = buildUserMap(users);
  const { selectedPipeline, columns } = getStageColumns(pipelines, pipelineId);
  const columnsById = new Map(columns.map((column) => [column.id, column]));
  const rowsByOwner = new Map();
  const totals = {
    values: {},
    stages: {},
    total: 0,
  };

  const ensureColumn = (stageId, fallbackName) => {
    const id = stageId || SIN_ETAPA_ID;

    if (!columnsById.has(id)) {
      const column = {
        id,
        name: fallbackName || (stageId ? "Etapa no encontrada" : "Sin etapa"),
        pipelineStageId: stageId || null,
      };

      columnsById.set(id, column);
      columns.push(column);
    }

    return columnsById.get(id);
  };

  opportunities
    .filter((opportunity) => {
      const opportunityPipelineId = getOpportunityPipelineId(opportunity);
      return !pipelineId || !opportunityPipelineId || opportunityPipelineId === pipelineId;
    })
    .forEach((opportunity) => {
      const stageId = getOpportunityStageId(opportunity);
      const column = ensureColumn(stageId, stageId ? "Etapa no encontrada" : "Sin etapa");
      const owner = resolveOwner(opportunity, userMap);

      if (!rowsByOwner.has(owner.id)) {
        rowsByOwner.set(owner.id, {
          ownerId: owner.id === SIN_PROPIETARIO_ID ? null : owner.id,
          ownerName: owner.name,
          propietario: owner.name,
          values: {},
          stages: {},
          total: 0,
        });
      }

      const row = rowsByOwner.get(owner.id);
      row.values[column.id] = (row.values[column.id] || 0) + 1;
      row.stages[column.id] = row.values[column.id];
      row.total += 1;

      totals.values[column.id] = (totals.values[column.id] || 0) + 1;
      totals.stages[column.id] = totals.values[column.id];
      totals.total += 1;
    });

  const rows = Array.from(rowsByOwner.values())
    .map((row) => {
      columns.forEach((column) => {
        row.values[column.id] = row.values[column.id] || 0;
        row.stages[column.id] = row.values[column.id];
      });
      return row;
    })
    .sort((a, b) => b.total - a.total || a.ownerName.localeCompare(b.ownerName));

  columns.forEach((column) => {
    totals.values[column.id] = totals.values[column.id] || 0;
    totals.stages[column.id] = totals.values[column.id];
  });

  return {
    columns,
    rows,
    totals,
    meta: {
      pipelineId: pipelineId || toId(selectedPipeline?.id || selectedPipeline?._id) || null,
      pipelineName: getFullName(selectedPipeline) || selectedPipeline?.name || null,
      opportunityCount: totals.total,
      ownerCount: rows.length,
      generatedAt: new Date().toISOString(),
    },
  };
};

const buildPautasPerformance = ({
  opportunities = [],
  pipelines = [],
  pipelineId = "",
  customFieldDefinitions = [],
  sourceIdsByContact = new Map(),
  etapa = "",
  status = "",
  sourceId = "",
} = {}) => {
  const customFieldDefinitionMap =
    customFieldDefinitions instanceof Map
      ? customFieldDefinitions
      : buildCustomFieldDefinitionMap(customFieldDefinitions);
  const { selectedPipeline, columns } = getStageColumns(pipelines, pipelineId);
  const columnsById = new Map(columns.map((column) => [column.id, column]));

  const ensureColumn = (opportunity) => {
    const stageId = getOpportunityStageId(opportunity) || SIN_ETAPA_ID;

    if (!columnsById.has(stageId)) {
      const stageEntity = opportunity?.pipelineStage || opportunity?.stage;
      const stageName =
        getFullName(stageEntity) ||
        stageEntity?.title ||
        stageEntity?.label ||
        (stageId === SIN_ETAPA_ID ? "Sin etapa" : "Etapa no encontrada");
      const column = {
        id: stageId,
        name: String(stageName).trim(),
        pipelineStageId: stageId === SIN_ETAPA_ID ? null : stageId,
      };

      columnsById.set(stageId, column);
      columns.push(column);
    }

    return columnsById.get(stageId);
  };

  const pipelineOpportunities = dedupeOpportunitiesById(opportunities).filter(
    (opportunity) => {
      const opportunityPipelineId = getOpportunityPipelineId(opportunity);
      return !pipelineId || !opportunityPipelineId || opportunityPipelineId === pipelineId;
    },
  );

  pipelineOpportunities.forEach(ensureColumn);

  const discoveredStatuses = new Set(
    pipelineOpportunities.map(getOpportunityStatus),
  );
  const statusIds = [
    ...PAUTAS_OPPORTUNITY_STATUSES,
    ...Array.from(discoveredStatuses)
      .filter(
        (opportunityStatus) =>
          !PAUTAS_OPPORTUNITY_STATUSES.includes(opportunityStatus),
      )
      .sort((first, second) => first.localeCompare(second, "es")),
  ];
  const statusColumns = statusIds.map((statusId) => ({
    id: statusId,
    name: statusId.toUpperCase(),
  }));
  const requestedStage = String(etapa || "").trim();
  const normalizedRequestedStage = normalizeComparableText(requestedStage);
  const requestedStatus = String(status || "").trim().toLowerCase();
  const requestedSourceId = normalizeComparableText(sourceId);
  const rowsBySourceId = new Map();

  pipelineOpportunities.forEach((opportunity) => {
    const column = ensureColumn(opportunity);
    const opportunityStatus = getOpportunityStatus(opportunity);
    const matchesStage =
      !requestedStage ||
      column.id === requestedStage ||
      normalizeComparableText(column.name) === normalizedRequestedStage;
    const matchesStatus =
      !requestedStatus ||
      (requestedStatus === "otros"
        ? !PAUTAS_OPPORTUNITY_STATUSES.includes(opportunityStatus)
        : opportunityStatus === requestedStatus);

    if (!matchesStage || !matchesStatus) return;

    const contactId = getOpportunityContactId(opportunity);
    const directSourceId = extractSourceIdFromOpportunity(
      opportunity,
      customFieldDefinitionMap,
    );
    const contactSourceId =
      sourceIdsByContact instanceof Map
        ? sourceIdsByContact.get(contactId)
        : sourceIdsByContact?.[contactId];
    const resolvedSourceId =
      directSourceId || normalizeSourceIdValue(contactSourceId) || SIN_SOURCE_ID;

    if (
      requestedSourceId &&
      !normalizeComparableText(resolvedSourceId).includes(requestedSourceId)
    ) {
      return;
    }

    if (!rowsBySourceId.has(resolvedSourceId)) {
      rowsBySourceId.set(resolvedSourceId, {
        sourceId: resolvedSourceId,
        label: resolvedSourceId,
        values: {},
        statusValues: {},
        total: 0,
        aplicanTotal: 0,
        noAplicanTotal: 0,
        noContestaTotal: 0,
        openTotal: 0,
        wonTotal: 0,
        lostTotal: 0,
        abandonedTotal: 0,
      });
    }

    const row = rowsBySourceId.get(resolvedSourceId);
    const metricGroup = getStageMetricGroup(column.name);

    row.values[column.id] = (row.values[column.id] || 0) + 1;
    row.statusValues[opportunityStatus] =
      (row.statusValues[opportunityStatus] || 0) + 1;
    row.total += 1;

    if (metricGroup === "aplican") row.aplicanTotal += 1;
    if (metricGroup === "noAplican") row.noAplicanTotal += 1;
    if (metricGroup === "noContesta") row.noContestaTotal += 1;
    if (opportunityStatus === "open") row.openTotal += 1;
    if (opportunityStatus === "won") row.wonTotal += 1;
    if (opportunityStatus === "lost") row.lostTotal += 1;
    if (opportunityStatus === "abandoned") row.abandonedTotal += 1;
  });

  const rows = Array.from(rowsBySourceId.values())
    .map((row) => {
      columns.forEach((column) => {
        row.values[column.id] = row.values[column.id] || 0;
      });
      statusColumns.forEach((statusColumn) => {
        row.statusValues[statusColumn.id] =
          row.statusValues[statusColumn.id] || 0;
      });

      return {
        ...row,
        tasaAplicacion: roundPercentage(row.aplicanTotal, row.total),
        tasaNoContesta: roundPercentage(row.noContestaTotal, row.total),
        tasaNoAplicacion: roundPercentage(row.noAplicanTotal, row.total),
        tasaWon: roundPercentage(row.wonTotal, row.total),
        tasaLost: roundPercentage(row.lostTotal, row.total),
        tasaAbandoned: roundPercentage(row.abandonedTotal, row.total),
      };
    })
    .sort(
      (first, second) =>
        second.total - first.total ||
        second.aplicanTotal - first.aplicanTotal ||
        first.sourceId.localeCompare(second.sourceId, "es"),
    );

  const totals = rows.reduce(
    (accumulator, row) => {
      columns.forEach((column) => {
        accumulator.values[column.id] =
          (accumulator.values[column.id] || 0) +
          Number(row.values[column.id] || 0);
      });
      statusColumns.forEach((statusColumn) => {
        accumulator.statusValues[statusColumn.id] =
          (accumulator.statusValues[statusColumn.id] || 0) +
          Number(row.statusValues[statusColumn.id] || 0);
      });
      accumulator.total += row.total;
      accumulator.aplicanTotal += row.aplicanTotal;
      accumulator.noAplicanTotal += row.noAplicanTotal;
      accumulator.noContestaTotal += row.noContestaTotal;
      accumulator.openTotal += row.openTotal;
      accumulator.wonTotal += row.wonTotal;
      accumulator.lostTotal += row.lostTotal;
      accumulator.abandonedTotal += row.abandonedTotal;
      return accumulator;
    },
    {
      values: {},
      statusValues: {},
      total: 0,
      aplicanTotal: 0,
      noAplicanTotal: 0,
      noContestaTotal: 0,
      openTotal: 0,
      wonTotal: 0,
      lostTotal: 0,
      abandonedTotal: 0,
    },
  );

  columns.forEach((column) => {
    totals.values[column.id] = totals.values[column.id] || 0;
  });
  statusColumns.forEach((statusColumn) => {
    totals.statusValues[statusColumn.id] =
      totals.statusValues[statusColumn.id] || 0;
  });

  const sourceIdCount = rows.filter(
    (row) => row.sourceId !== SIN_SOURCE_ID,
  ).length;
  totals.totalOportunidades = totals.total;
  totals.totalSourceIds = sourceIdCount;
  totals.tasaAplicacion = roundPercentage(totals.aplicanTotal, totals.total);
  totals.tasaNoContesta = roundPercentage(totals.noContestaTotal, totals.total);
  totals.tasaNoAplicacion = roundPercentage(
    totals.noAplicanTotal,
    totals.total,
  );
  totals.tasaWon = roundPercentage(totals.wonTotal, totals.total);
  totals.tasaLost = roundPercentage(totals.lostTotal, totals.total);
  totals.tasaAbandoned = roundPercentage(
    totals.abandonedTotal,
    totals.total,
  );
  totals.tasaAplicacionGeneral = totals.tasaAplicacion;
  totals.tasaNoContestaGeneral = totals.tasaNoContesta;
  totals.tasaNoAplicacionGeneral = totals.tasaNoAplicacion;

  return {
    columns,
    statusColumns,
    rows,
    totals,
    meta: {
      pipelineId:
        pipelineId || toId(selectedPipeline?.id || selectedPipeline?._id) || null,
      pipelineName:
        getFullName(selectedPipeline) || selectedPipeline?.name || null,
      sourceIdCount,
      rowCount: rows.length,
      opportunityCount: totals.total,
      generatedAt: new Date().toISOString(),
    },
  };
};

const fetchAllOpenOpportunities = async (client, config, dateFilters = {}) => {
  const opportunities = [];
  const seenOpportunityIds = new Set();
  const seenCursors = new Set();
  const limit = DEFAULT_LIMIT;
  let cursor = null;

  for (let page = 0; page < MAX_OPPORTUNITY_PAGES; page += 1) {
    const camelCaseParams = {
      locationId: config.locationId,
      pipelineId: config.pipelineId,
      status: "open",
      limit,
    };
    const snakeCaseParams = {
      location_id: config.locationId,
      pipeline_id: config.pipelineId,
      status: "open",
      limit,
    };

    if (cursor?.startAfterId) {
      camelCaseParams.startAfterId = cursor.startAfterId;
      snakeCaseParams.startAfterId = cursor.startAfterId;
    }

    if (cursor?.startAfter) {
      camelCaseParams.startAfter = cursor.startAfter;
      snakeCaseParams.startAfter = cursor.startAfter;
    }

    const payload = await requestGhlWithFallback(
      client,
      {
        method: "GET",
        url: "/opportunities/search",
        params: camelCaseParams,
      },
      {
        method: "GET",
        url: "/opportunities/search",
        params: snakeCaseParams,
      },
      (error) =>
        errorHasAnyMessage(error, [
          "property locationId should not exist",
          "property pipelineId should not exist",
          "location_id must be a string",
          "location_id should not be empty",
        ]),
    );

    const pageItems = extractOpportunities(payload).filter(Boolean);
    const pageItemsInRange = filterOpportunitiesByDateRange(pageItems, dateFilters);

    pageItemsInRange.forEach((opportunity) => {
      const opportunityId = toId(opportunity?.id || opportunity?._id);
      if (opportunityId && seenOpportunityIds.has(opportunityId)) return;
      if (opportunityId) seenOpportunityIds.add(opportunityId);
      opportunities.push(opportunity);
    });

    if (shouldStopDatePagination(pageItems, dateFilters)) {
      break;
    }

    const nextCursor = getNextPaginationCursor(payload, pageItems, limit);
    const nextCursorKey = nextCursor
      ? `${nextCursor.startAfterId}::${nextCursor.startAfter || ""}`
      : "";

    if (!nextCursor || seenCursors.has(nextCursorKey) || pageItems.length === 0) {
      break;
    }

    if (pageItems.length < limit && !hasExplicitNextPage(payload)) {
      break;
    }

    seenCursors.add(nextCursorKey);
    cursor = nextCursor;
  }

  return opportunities;
};

const fetchOpportunitiesByStatus = async (
  client,
  config,
  status,
  dateFilters = {},
) => {
  const opportunities = [];
  const seenOpportunityIds = new Set();
  const seenCursors = new Set();
  const limit = DEFAULT_LIMIT;
  let cursor = null;

  for (let page = 0; page < MAX_OPPORTUNITY_PAGES; page += 1) {
    const camelCaseParams = {
      locationId: config.locationId,
      pipelineId: config.pipelineId,
      limit,
    };
    const snakeCaseParams = {
      location_id: config.locationId,
      pipeline_id: config.pipelineId,
      limit,
    };
    if (status) {
      camelCaseParams.status = status;
      snakeCaseParams.status = status;
    }

    if (cursor?.startAfterId) {
      camelCaseParams.startAfterId = cursor.startAfterId;
      snakeCaseParams.startAfterId = cursor.startAfterId;
    }

    if (cursor?.startAfter) {
      camelCaseParams.startAfter = cursor.startAfter;
      snakeCaseParams.startAfter = cursor.startAfter;
    }

    const payload = await requestGhlWithFallback(
      client,
      {
        method: "GET",
        url: "/opportunities/search",
        params: camelCaseParams,
      },
      {
        method: "GET",
        url: "/opportunities/search",
        params: snakeCaseParams,
      },
      (error) =>
        errorHasAnyMessage(error, [
          "property locationId should not exist",
          "property pipelineId should not exist",
          "location_id must be a string",
          "location_id should not be empty",
        ]),
    );

    const pageItems = extractOpportunities(payload).filter(Boolean);
    const pageItemsInRange = filterOpportunitiesByDateRange(
      pageItems,
      dateFilters,
    );

    pageItemsInRange.forEach((opportunity) => {
      const opportunityId = toId(opportunity?.id || opportunity?._id);
      if (opportunityId && seenOpportunityIds.has(opportunityId)) return;
      if (opportunityId) seenOpportunityIds.add(opportunityId);
      opportunities.push(opportunity);
    });

    if (shouldStopDatePagination(pageItems, dateFilters)) break;

    const nextCursor = getNextPaginationCursor(payload, pageItems, limit);
    const nextCursorKey = nextCursor
      ? `${nextCursor.startAfterId}::${nextCursor.startAfter || ""}`
      : "";

    if (!nextCursor || seenCursors.has(nextCursorKey) || pageItems.length === 0) {
      break;
    }

    if (pageItems.length < limit && !hasExplicitNextPage(payload)) break;

    seenCursors.add(nextCursorKey);
    cursor = nextCursor;
  }

  return opportunities;
};

const fetchAllOpportunityStatuses = async (
  client,
  config,
  dateFilters = {},
) => {
  try {
    return dedupeOpportunitiesById(
      await fetchOpportunitiesByStatus(client, config, "", dateFilters),
    );
  } catch (error) {
    if (error?.code !== "GHL_BAD_REQUEST") throw error;
  }

  const opportunities = [];

  for (const status of PAUTAS_OPPORTUNITY_STATUSES) {
    const statusOpportunities = await fetchOpportunitiesByStatus(
      client,
      config,
      status,
      dateFilters,
    );
    opportunities.push(...statusOpportunities);
  }

  return dedupeOpportunitiesById(opportunities);
};

const fetchPipelines = async (client, config) => {
  const payload = await requestGhlWithFallback(
    client,
    {
      method: "GET",
      url: "/opportunities/pipelines",
      params: {
        locationId: config.locationId,
      },
    },
    {
      method: "GET",
      url: "/opportunities/pipelines",
      params: {
        location_id: config.locationId,
      },
    },
    (error) =>
      errorHasAnyMessage(error, [
        "property locationId should not exist",
        "location_id must be a string",
        "location_id should not be empty",
      ]),
  );

  return extractPipelines(payload).filter(Boolean);
};

const extractCustomFieldDefinitions = (payload) =>
  pickArray(payload, ["customFields", "custom_fields", "fields", "data"]);

const fetchContactCustomFieldDefinitions = async (client, config) => {
  const payload = await requestGhl(client, {
    method: "GET",
    url: `/locations/${config.locationId}/customFields`,
    params: {
      model: "contact",
    },
  });

  return extractCustomFieldDefinitions(payload).filter(Boolean);
};

const extractContact = (payload = {}) =>
  payload?.contact || payload?.data?.contact || payload?.data || payload;

const mapWithConcurrency = async (items, concurrency, mapper) => {
  if (!items.length) return [];

  const safeConcurrency = Math.max(
    1,
    Math.min(Number(concurrency) || 1, items.length),
  );
  const results = new Array(items.length);
  let nextIndex = 0;

  const worker = async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  };

  await Promise.all(
    Array.from({ length: safeConcurrency }, () => worker()),
  );
  return results;
};

const createRequestThrottle = (minimumIntervalMs = 0) => {
  let queue = Promise.resolve();
  let nextRequestAt = 0;
  let pauseUntil = 0;

  const waitForTurn = () => {
    const turn = queue.then(async () => {
      const waitMs =
        Math.max(nextRequestAt, pauseUntil) - Date.now();
      if (waitMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
      nextRequestAt = Date.now() + Math.max(0, minimumIntervalMs);
    });

    queue = turn.catch(() => {});
    return turn;
  };

  waitForTurn.pause = (milliseconds) => {
    pauseUntil = Math.max(
      pauseUntil,
      Date.now() + Math.max(0, Number(milliseconds) || 0),
    );
  };

  return waitForTurn;
};

const fetchContactsByIdsInBatches = async ({
  client,
  locationId,
  contactIds = [],
}) => {
  const contactsById = new Map();
  const requestedBatchSize = Number(
    process.env.GHL_CONTACT_BATCH_SIZE ?? 100,
  );
  const batchSize = Number.isFinite(requestedBatchSize)
    ? Math.min(100, Math.max(1, requestedBatchSize))
    : 100;

  for (let index = 0; index < contactIds.length; index += batchSize) {
    const contactIdBatch = contactIds.slice(index, index + batchSize);
    const payload = await requestGhl(client, {
      method: "POST",
      url: "/contacts/search",
      data: {
        locationId,
        page: 1,
        pageLimit: contactIdBatch.length,
        filters: [
          {
            field: "id",
            operator: "eq",
            value: contactIdBatch,
          },
        ],
      },
    });

    extractContacts(payload)
      .filter(Boolean)
      .forEach((contact) => {
        const contactId = toId(contact?.id || contact?._id);
        if (contactId) contactsById.set(contactId, contact);
      });
  }

  return contactsById;
};

const pruneContactSourceIdCache = () => {
  const now = Date.now();
  for (const [contactId, entry] of contactSourceIdCache.entries()) {
    if (entry.expiresAt <= now) contactSourceIdCache.delete(contactId);
  }
};

const getCachedContactSourceId = (contactId) => {
  const entry = contactSourceIdCache.get(contactId);
  if (!entry) return { found: false, value: null };

  if (entry.expiresAt <= Date.now()) {
    contactSourceIdCache.delete(contactId);
    return { found: false, value: null };
  }

  return {
    found: true,
    value: entry.value,
  };
};

const setCachedContactSourceId = (contactId, sourceId) => {
  if (!contactId) return;

  const ttlMs = getNonNegativeEnvNumber(
    "GHL_CONTACT_SOURCE_CACHE_TTL_MS",
    30 * 60 * 1000,
  );
  const maximumEntries = Math.max(
    100,
    getNonNegativeEnvNumber("GHL_CONTACT_SOURCE_CACHE_MAX_ENTRIES", 10000),
  );

  if (contactSourceIdCache.has(contactId)) {
    contactSourceIdCache.delete(contactId);
  }

  while (contactSourceIdCache.size >= maximumEntries) {
    const oldestContactId = contactSourceIdCache.keys().next().value;
    if (!oldestContactId) break;
    contactSourceIdCache.delete(oldestContactId);
  }

  contactSourceIdCache.set(contactId, {
    value: normalizeSourceIdValue(sourceId) || null,
    expiresAt: Date.now() + ttlMs,
  });
};

const resolveSourceIdsForOpportunities = async ({
  client,
  opportunities = [],
  customFieldDefinitions = [],
  locationId = "",
}) => {
  const customFieldDefinitionMap =
    customFieldDefinitions instanceof Map
      ? customFieldDefinitions
      : buildCustomFieldDefinitionMap(customFieldDefinitions);
  const sourceIdsByContact = new Map();
  const contactIdsToFetch = new Set();
  pruneContactSourceIdCache();

  dedupeOpportunitiesById(opportunities).forEach((opportunity) => {
    const contactId = getOpportunityContactId(opportunity);
    if (!contactId) return;

    const directSourceId = extractSourceIdFromOpportunity(
      opportunity,
      customFieldDefinitionMap,
    );

    if (directSourceId) {
      sourceIdsByContact.set(contactId, directSourceId);
      setCachedContactSourceId(contactId, directSourceId);
      return;
    }

    const cachedSourceId = getCachedContactSourceId(contactId);
    if (cachedSourceId.found) {
      sourceIdsByContact.set(contactId, cachedSourceId.value);
      return;
    }

    contactIdsToFetch.add(contactId);
  });

  const uniqueContactIds = Array.from(contactIdsToFetch).filter(
    (contactId) => !sourceIdsByContact.has(contactId),
  );

  if (uniqueContactIds.length && locationId) {
    try {
      const contactsById = await fetchContactsByIdsInBatches({
        client,
        locationId,
        contactIds: uniqueContactIds,
      });

      uniqueContactIds.forEach((contactId) => {
        const sourceId = extractSourceIdFromContact(
          contactsById.get(contactId),
          customFieldDefinitionMap,
        );
        sourceIdsByContact.set(contactId, sourceId || null);
        setCachedContactSourceId(contactId, sourceId || null);
      });

      return sourceIdsByContact;
    } catch (error) {
      const canFallbackToIndividualRequests =
        error.code === "GHL_BAD_REQUEST" || error.upstreamStatus === 404;

      if (!canFallbackToIndividualRequests) throw error;

      console.warn(
        "La busqueda agrupada de contactos GHL no esta disponible; se usara el fallback individual.",
        {
          code: error.code,
          upstreamStatus: error.upstreamStatus,
        },
      );
    }
  }

  const contactCache = new Map();
  const requestedConcurrency = Number(
    process.env.GHL_CONTACT_CONCURRENCY ?? 3,
  );
  const requestedMinimumInterval = Number(
    process.env.GHL_CONTACT_MIN_INTERVAL_MS ?? 150,
  );
  const requestedMaximumRetries = Number(
    process.env.GHL_CONTACT_MAX_RETRIES ?? 2,
  );
  const requestedRetryDelay = Number(
    process.env.GHL_CONTACT_RETRY_DELAY_MS ?? 1000,
  );
  const configuredConcurrency = Number.isFinite(requestedConcurrency)
    ? Math.min(10, Math.max(1, requestedConcurrency))
    : 3;
  const minimumIntervalMs = Number.isFinite(requestedMinimumInterval)
    ? Math.max(0, requestedMinimumInterval)
    : 150;
  const maximumRetries = Number.isFinite(requestedMaximumRetries)
    ? Math.min(4, Math.max(0, requestedMaximumRetries))
    : 2;
  const retryBaseDelayMs = Number.isFinite(requestedRetryDelay)
    ? Math.max(100, requestedRetryDelay)
    : 1000;
  const waitForRequestTurn = createRequestThrottle(minimumIntervalMs);
  const contactFailures = [];
  const failedContactIds = new Set();

  await mapWithConcurrency(
    uniqueContactIds,
    configuredConcurrency,
    async (contactId) => {
      if (contactCache.has(contactId)) return contactCache.get(contactId);

      for (let attempt = 0; attempt <= maximumRetries; attempt += 1) {
        await waitForRequestTurn();

        try {
          const payload = await requestGhl(client, {
            method: "GET",
            url: `/contacts/${encodeURIComponent(contactId)}`,
          });
          const contact = extractContact(payload);
          contactCache.set(contactId, contact);
          return contact;
        } catch (error) {
          const shouldRetry =
            error.upstreamStatus === 429 && attempt < maximumRetries;

          if (shouldRetry) {
            const retryDelayMs =
              error.retryAfterMs ??
              retryBaseDelayMs * 2 ** attempt;
            waitForRequestTurn.pause(retryDelayMs);
            continue;
          }

          contactCache.set(contactId, null);
          failedContactIds.add(contactId);
          contactFailures.push({
            code: error.code,
            statusCode: error.statusCode,
            upstreamStatus: error.upstreamStatus,
          });
          return null;
        }
      }

      return null;
    },
  );

  if (contactFailures.length) {
    console.warn("No se pudieron consultar algunos contactos para el reporte GHL.", {
      count: contactFailures.length,
      codes: Array.from(
        new Set(contactFailures.map((failure) => failure.code).filter(Boolean)),
      ),
      upstreamStatuses: Array.from(
        new Set(
          contactFailures
            .map((failure) => failure.upstreamStatus)
            .filter(Boolean),
        ),
      ),
    });

    if (
      contactFailures.some((failure) => failure.upstreamStatus === 429)
    ) {
      const rateLimitError = new Error(
        "HighLevel alcanzo temporalmente su limite de consultas.",
      );
      rateLimitError.code = "GHL_RATE_LIMITED";
      rateLimitError.statusCode = 503;
      rateLimitError.upstreamStatus = 429;
      throw rateLimitError;
    }
  }

  uniqueContactIds.forEach((contactId) => {
    const sourceId = extractSourceIdFromContact(
      contactCache.get(contactId),
      customFieldDefinitionMap,
    );
    sourceIdsByContact.set(contactId, sourceId || null);
    if (!failedContactIds.has(contactId)) {
      setCachedContactSourceId(contactId, sourceId || null);
    }
  });

  return sourceIdsByContact;
};

const extractCompanyIdFromLocation = (payload = {}) => {
  const location = payload.location || payload.data || payload;
  return toId(location?.companyId || location?.company_id || payload.companyId || payload.company_id);
};

const fetchCompanyId = async (client, config) => {
  if (config.companyId) return config.companyId;

  const payload = await requestGhl(client, {
    method: "GET",
    url: `/locations/${config.locationId}`,
  });

  return extractCompanyIdFromLocation(payload);
};

const fetchUsers = async (client, config) => {
  let companyId = "";

  try {
    companyId = await fetchCompanyId(client, config);
  } catch (error) {
    if (error.code === "GHL_UNAUTHORIZED") throw error;
    console.warn(
      "No se pudo obtener companyId desde HighLevel; se usaran IDs de assignedTo.",
      error.message
    );
    return [];
  }

  if (!companyId) {
    console.warn("HighLevel no devolvio companyId; se usaran IDs de assignedTo.");
    return [];
  }

  let payload;

  try {
    payload = await requestGhl(client, {
      method: "GET",
      url: "/users/search",
      params: {
        companyId,
        locationId: config.locationId,
        limit: DEFAULT_LIMIT,
      },
    });
  } catch (error) {
    if (error.code === "GHL_UNAUTHORIZED") throw error;
    console.warn("No se pudieron consultar usuarios GHL; se usaran IDs de assignedTo.", error.message);
    return [];
  }

  return extractUsers(payload).filter(Boolean);
};

const resolvePautasDateFilters = ({ fechaInicio, fechaFin } = {}) => {
  const dateFilters = resolveDateFilters({ fechaInicio, fechaFin });
  const isValidDateInput = (value) => {
    if (!value) return true;
    const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return false;

    const [, year, month, day] = match;
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    return (
      date.getUTCFullYear() === Number(year) &&
      date.getUTCMonth() === Number(month) - 1 &&
      date.getUTCDate() === Number(day)
    );
  };
  const startDate = parseDateBoundary(dateFilters.fechaInicio, false);
  const endDate = parseDateBoundary(dateFilters.fechaFin, true);

  if (
    !isValidDateInput(dateFilters.fechaInicio) ||
    !isValidDateInput(dateFilters.fechaFin) ||
    (dateFilters.fechaInicio && !startDate) ||
    (dateFilters.fechaFin && !endDate) ||
    (startDate && endDate && startDate > endDate)
  ) {
    const error = new Error("El rango de fechas no es valido");
    error.statusCode = 400;
    error.code = "GHL_INVALID_DATE_RANGE";
    throw error;
  }

  return dateFilters;
};

const isTemporaryGhlError = (error) =>
  ["GHL_RATE_LIMITED", "GHL_CONNECTION_ERROR", "GHL_UPSTREAM_ERROR"].includes(
    error?.code,
  );

const prunePautasDataCache = () => {
  const now = Date.now();
  for (const [cacheKey, entry] of pautasDataCache.entries()) {
    if (entry.staleUntil <= now) pautasDataCache.delete(cacheKey);
  }
};

const getOrLoadPautasData = async ({ cacheKey, loader }) => {
  prunePautasDataCache();

  const now = Date.now();
  const existingEntry = pautasDataCache.get(cacheKey);
  if (existingEntry && existingEntry.expiresAt > now) {
    return {
      data: existingEntry.data,
      cache: {
        hit: true,
        stale: false,
        coalesced: false,
        fetchedAt: existingEntry.fetchedAt,
        expiresAt: new Date(existingEntry.expiresAt).toISOString(),
      },
    };
  }

  let loaderPromise = pautasInFlight.get(cacheKey);
  const coalesced = Boolean(loaderPromise);

  if (!loaderPromise) {
    const ttlMs = getNonNegativeEnvNumber(
      "GHL_PAUTAS_CACHE_TTL_MS",
      5 * 60 * 1000,
    );
    const staleTtlMs = Math.max(
      ttlMs,
      getNonNegativeEnvNumber(
        "GHL_PAUTAS_STALE_TTL_MS",
        30 * 60 * 1000,
      ),
    );

    loaderPromise = (async () => {
      await Promise.resolve();
      try {
        const data = await loader();
        const fetchedAt = new Date().toISOString();
        pautasDataCache.set(cacheKey, {
          data,
          fetchedAt,
          expiresAt: Date.now() + ttlMs,
          staleUntil: Date.now() + staleTtlMs,
        });
        return data;
      } finally {
        if (pautasInFlight.get(cacheKey) === loaderPromise) {
          pautasInFlight.delete(cacheKey);
        }
      }
    })();
    pautasInFlight.set(cacheKey, loaderPromise);
  }

  try {
    const data = await loaderPromise;
    const loadedEntry = pautasDataCache.get(cacheKey);
    return {
      data,
      cache: {
        hit: coalesced,
        stale: false,
        coalesced,
        fetchedAt: loadedEntry?.fetchedAt || new Date().toISOString(),
        expiresAt: loadedEntry
          ? new Date(loadedEntry.expiresAt).toISOString()
          : null,
      },
    };
  } catch (error) {
    if (
      existingEntry &&
      existingEntry.staleUntil > Date.now() &&
      isTemporaryGhlError(error)
    ) {
      return {
        data: existingEntry.data,
        cache: {
          hit: true,
          stale: true,
          coalesced,
          fallbackReason: error.code,
          fetchedAt: existingEntry.fetchedAt,
          expiresAt: new Date(existingEntry.expiresAt).toISOString(),
        },
      };
    }

    throw error;
  }
};

const loadPautasBaseData = async ({ client, config, dateFilters }) => {
  const [opportunities, pipelines, customFieldDefinitions] = await Promise.all([
    fetchAllOpportunityStatuses(client, config, dateFilters),
    fetchPipelines(client, config),
    fetchContactCustomFieldDefinitions(client, config),
  ]);
  const sourceIdsByContact = await resolveSourceIdsForOpportunities({
    client,
    opportunities,
    customFieldDefinitions,
    locationId: config.locationId,
  });

  return {
    opportunities,
    pipelines,
    customFieldDefinitions,
    sourceIdsByContact,
  };
};

const clearPautasCaches = () => {
  pautasDataCache.clear();
  pautasInFlight.clear();
  contactSourceIdCache.clear();
};

async function obtenerMatrizOportunidadesDashboard({ fechaInicio, fechaFin } = {}) {
  const config = getGhlConfig();
  const client = createGhlClient(config);
  const dateFilters = resolveDateFilters({ fechaInicio, fechaFin });

  const [opportunities, pipelines, users] = await Promise.all([
    fetchAllOpenOpportunities(client, config, dateFilters),
    fetchPipelines(client, config),
    fetchUsers(client, config),
  ]);

  return buildOpportunitiesMatrix({
    opportunities,
    pipelines,
    users,
    pipelineId: config.pipelineId,
  });
}

async function obtenerRendimientoPautasPorSourceId({
  fechaInicio,
  fechaFin,
  etapa,
  status,
  sourceId,
} = {}) {
  const config = getGhlConfig();
  const client = createGhlClient(config);
  const dateFilters = resolvePautasDateFilters({ fechaInicio, fechaFin });
  const cacheKey = [
    config.locationId,
    config.pipelineId,
    dateFilters.fechaInicio || "",
    dateFilters.fechaFin || "",
  ].join("::");
  const { data, cache } = await getOrLoadPautasData({
    cacheKey,
    loader: () =>
      loadPautasBaseData({
        client,
        config,
        dateFilters,
      }),
  });

  const report = buildPautasPerformance({
    opportunities: data.opportunities,
    pipelines: data.pipelines,
    pipelineId: config.pipelineId,
    customFieldDefinitions: data.customFieldDefinitions,
    sourceIdsByContact: data.sourceIdsByContact,
    etapa,
    status,
    sourceId,
  });
  report.meta.cache = cache;
  report.meta.generatedAt = cache.fetchedAt || report.meta.generatedAt;

  return report;
}

async function enviarAGHL({
  phone,
  message,
  origen,
  campania,
  instancia,
  instanciaPauta,
  sourceId,
  sourceUrl,
  ctwaClid,
  isFromMe,
  vieneDeAnuncio,
}) {
  const config = getGhlConfig({ requirePipelineId: false });

  if (!phone) {
    throw new Error("No se pudo detectar el telefono del cliente");
  }

  const hayCampaniaDetectada =
    campania && campania !== "Sin campana detectada" && String(campania).trim() !== "";
  const origenDetectado = origen || "WhatsApp";
  const origenNumero = instancia || origenDetectado;
  const canalMensaje = vieneDeAnuncio
    ? "WhatsApp Stevo - Meta Ads"
    : isFromMe
      ? "WhatsApp Stevo - Asesor"
      : "WhatsApp Stevo - Cliente";

  const customFields = [
    {
      key: "origen_ultimo_mensaje",
      field_value: origenDetectado,
    },
    {
      key: "origen",
      field_value: origenNumero,
    },
    {
      key: "fuente_origen",
      field_value: origenNumero,
    },
    {
      key: "origen_detectado",
      field_value: origenDetectado,
    },
    {
      key: "canal_ultimo_mensaje",
      field_value: canalMensaje,
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

  if (instancia) {
    customFields.push({
      key: "instancia_gestion",
      field_value: instancia,
    });
  }

  if (vieneDeAnuncio && instanciaPauta) {
    customFields.push({
      key: "campania_origen",
      field_value: instanciaPauta,
    });
  }

  if (vieneDeAnuncio && hayCampaniaDetectada) {
    customFields.push({
      key: "nombre_campania_meta",
      field_value: campania,
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

  const payloadGHL = {
    locationId: config.locationId,
    phone,
    source: origenNumero,
    customFields,
  };

  const response = await axios.post(`${config.baseUrl}/contacts/upsert`, payloadGHL, {
    headers: {
      Authorization: `Bearer ${config.token}`,
      Version: process.env.GHL_CONTACTS_API_VERSION || "2021-07-28",
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    timeout: 15000,
  });

  return response.data;
}

module.exports = {
  enviarAGHL,
  obtenerMatrizOportunidadesDashboard,
  obtenerRendimientoPautasPorSourceId,
  buildOpportunitiesMatrix,
  buildPautasPerformance,
  buildCustomFieldDefinitionMap,
  dedupeOpportunitiesById,
  extractSourceIdFromContact,
  extractSourceIdFromOpportunity,
  getOpportunityContactId,
  getOpportunityStatus,
  fetchAllOpportunityStatuses,
  fetchContactsByIdsInBatches,
  mapWithConcurrency,
  resolveSourceIdsForOpportunities,
  resolvePautasDateFilters,
  getOrLoadPautasData,
  clearPautasCaches,
  extractOpportunities,
  extractPipelines,
  extractUsers,
  extractContacts,
  getNextStartAfterId,
  errorHasAnyMessage,
  extractCompanyIdFromLocation,
  filterOpportunitiesByDateRange,
  getNextPaginationCursor,
  shouldStopDatePagination,
  resolveDateFilters,
};
