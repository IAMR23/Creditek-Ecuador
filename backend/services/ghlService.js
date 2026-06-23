const axios = require("axios");

const DEFAULT_GHL_BASE_URL = "https://services.leadconnectorhq.com";
const DEFAULT_GHL_API_VERSION = "2023-02-21";
const DEFAULT_LIMIT = 100;
const MAX_OPPORTUNITY_PAGES = 500;
const SIN_PROPIETARIO_ID = "sin-propietario";
const SIN_ETAPA_ID = "sin-etapa";

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

const extractOpportunities = (payload) =>
  pickArray(payload, ["opportunities", "opportunity", "data", "items"]);

const extractPipelines = (payload) =>
  pickArray(payload, ["pipelines", "pipeline", "data", "items"]);

const extractUsers = (payload) => pickArray(payload, ["users", "user", "data", "items"]);

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
    source: vieneDeAnuncio
      ? "WhatsApp Stevo - Meta Ads"
      : isFromMe
        ? "WhatsApp Stevo - Asesor"
        : "WhatsApp Stevo - Cliente",
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
  buildOpportunitiesMatrix,
  extractOpportunities,
  extractPipelines,
  extractUsers,
  getNextStartAfterId,
  errorHasAnyMessage,
  extractCompanyIdFromLocation,
  filterOpportunitiesByDateRange,
  getNextPaginationCursor,
  shouldStopDatePagination,
  resolveDateFilters,
};
