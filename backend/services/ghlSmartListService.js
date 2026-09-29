const { Op, fn, col, where } = require("sequelize");
const GhlDifusionLista = require("../models/GhlDifusionLista");
const { listContacts } = require("./ghlBroadcastService");

const compactString = (value) => String(value || "").trim();

const createError = (message, code, statusCode = 400) => {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
};

const FIELD_OPERATORS = Object.freeze({
  query: ["contains"],
  tags: ["eq", "not_eq", "contains", "not_contains"],
  source: ["eq", "not_eq", "contains", "not_contains"],
  firstName: ["eq", "not_eq", "contains", "not_contains"],
  lastName: ["eq", "not_eq", "contains", "not_contains"],
  email: ["eq", "not_eq", "contains", "not_contains"],
  phone: ["eq", "not_eq", "contains", "not_contains"],
  pipelineStageId: ["eq"],
});

const normalizeRule = (rule) => {
  const field = compactString(rule?.field);
  const operator = compactString(rule?.operator).toLowerCase();
  const value = compactString(rule?.value).slice(0, 150);
  const pipelineId = compactString(rule?.pipelineId).slice(0, 150);

  if (!Object.prototype.hasOwnProperty.call(FIELD_OPERATORS, field)) {
    throw createError("El campo seleccionado no es valido", "GHL_SMART_LIST_FIELD_INVALID");
  }
  if (!FIELD_OPERATORS[field].includes(operator)) {
    throw createError("El operador seleccionado no es valido", "GHL_SMART_LIST_OPERATOR_INVALID");
  }
  if (!value) {
    throw createError("Todos los filtros deben tener un valor", "GHL_SMART_LIST_VALUE_REQUIRED");
  }
  if (field === "pipelineStageId" && !pipelineId) {
    throw createError(
      "Debe seleccionar el pipeline de la etapa",
      "GHL_SMART_LIST_PIPELINE_REQUIRED",
    );
  }
  return {
    field,
    operator,
    value,
    ...(field === "pipelineStageId" ? { pipelineId } : {}),
  };
};

const normalizeFilters = (input = {}) => {
  const source = input.filtros && typeof input.filtros === "object" ? input.filtros : input;
  let rawRules = Array.isArray(source.rules) ? source.rules : [];

  // Convierte automaticamente las listas creadas con el primer formato.
  if (!rawRules.length) {
    rawRules = [
      ...(compactString(source.query)
        ? [{ field: "query", operator: "contains", value: source.query }]
        : []),
      ...(compactString(source.source)
        ? [{ field: "source", operator: "eq", value: source.source }]
        : []),
      ...(compactString(source.tag)
        ? [{ field: "tags", operator: "contains", value: source.tag }]
        : []),
    ];
  }

  if (!rawRules.length) {
    throw createError(
      "La lista inteligente debe tener al menos un filtro",
      "GHL_SMART_LIST_FILTER_REQUIRED",
    );
  }
  if (rawRules.length > 10) {
    throw createError(
      "La lista inteligente admite hasta 10 filtros",
      "GHL_SMART_LIST_FILTER_LIMIT",
    );
  }

  const rules = rawRules.map(normalizeRule);
  if (rules.filter((rule) => rule.field === "query").length > 1) {
    throw createError(
      "Solo puede existir un filtro de busqueda general",
      "GHL_SMART_LIST_QUERY_LIMIT",
    );
  }
  if (rules.filter((rule) => rule.field === "pipelineStageId").length > 1) {
    throw createError(
      "Solo puede existir un filtro de etapa del pipeline",
      "GHL_SMART_LIST_PIPELINE_STAGE_LIMIT",
    );
  }
  return { logic: "AND", rules };
};

const normalizePayload = (input = {}) => {
  const nombre = compactString(input.nombre).replace(/\s+/g, " ").slice(0, 120);
  if (nombre.length < 3) {
    throw createError(
      "El nombre de la lista debe tener al menos 3 caracteres",
      "GHL_SMART_LIST_NAME_INVALID",
    );
  }
  return { nombre, filtros: normalizeFilters(input) };
};

const serialize = (row) => {
  const value = row?.toJSON ? row.toJSON() : row;
  return {
    id: value.id,
    nombre: value.nombre,
    filtros: normalizeFilters(value.filtros || {}),
    creadoPorId: value.creadoPorId,
    actualizadoPorId: value.actualizadoPorId,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
};

const ensureUniqueName = async (model, nombre, excludedId = null) => {
  const duplicate = await model.findOne({
    where: {
      ...(excludedId ? { id: { [Op.ne]: excludedId } } : {}),
      [Op.and]: where(fn("LOWER", fn("TRIM", col("nombre"))), nombre.toLowerCase()),
    },
  });
  if (duplicate) {
    throw createError("Ya existe una lista con ese nombre", "GHL_SMART_LIST_NAME_DUPLICATE", 409);
  }
};

const findList = async (id, model = GhlDifusionLista) => {
  const parsedId = Number.parseInt(id, 10);
  if (!Number.isInteger(parsedId) || parsedId <= 0) {
    throw createError("Lista inteligente no valida", "GHL_SMART_LIST_ID_INVALID");
  }
  const row = await model.findByPk(parsedId);
  if (!row) throw createError("Lista inteligente no encontrada", "GHL_SMART_LIST_NOT_FOUND", 404);
  return row;
};

const listSmartLists = async (dependencies = {}) => {
  const model = dependencies.model || GhlDifusionLista;
  const rows = await model.findAll({ order: [["nombre", "ASC"]] });
  return rows.map(serialize);
};

const createSmartList = async (input, userId, dependencies = {}) => {
  const model = dependencies.model || GhlDifusionLista;
  const payload = normalizePayload(input);
  await ensureUniqueName(model, payload.nombre);
  const row = await model.create({
    ...payload,
    creadoPorId: userId,
    actualizadoPorId: userId,
  });
  return serialize(row);
};

const updateSmartList = async (id, input, userId, dependencies = {}) => {
  const model = dependencies.model || GhlDifusionLista;
  const row = await findList(id, model);
  const payload = normalizePayload(input);
  await ensureUniqueName(model, payload.nombre, row.id);
  await row.update({ ...payload, actualizadoPorId: userId });
  return serialize(row);
};

const deleteSmartList = async (id, dependencies = {}) => {
  const model = dependencies.model || GhlDifusionLista;
  const row = await findList(id, model);
  await row.destroy();
  return { id: row.id };
};

const listSmartListContacts = async (id, pagination = {}, dependencies = {}) => {
  const model = dependencies.model || GhlDifusionLista;
  const contactLoader = dependencies.listContacts || listContacts;
  const row = await findList(id, model);
  const filtros = normalizeFilters(row.filtros || {});
  const queryRule = filtros.rules.find((rule) => rule.field === "query");
  const filters = filtros.rules.filter((rule) => rule.field !== "query");
  const result = await contactLoader({
    query: queryRule?.value || "",
    page: pagination.page,
    pageSize: pagination.pageSize,
    filters,
  });
  return { lista: serialize(row), ...result };
};

module.exports = {
  createSmartList,
  deleteSmartList,
  listSmartListContacts,
  listSmartLists,
  normalizeFilters,
  normalizeRule,
  normalizePayload,
  updateSmartList,
};
