const { Op, fn, col, where } = require("sequelize");
const GhlDifusionMensaje = require("../models/GhlDifusionMensaje");
const { validateMessage } = require("./ghlBroadcastService");

const compactString = (value) => String(value || "").trim();

const createError = (message, code, statusCode = 400) => {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
};

const normalizePayload = (input = {}) => {
  const nombre = compactString(input.nombre).replace(/\s+/g, " ").slice(0, 120);
  if (nombre.length < 3) {
    throw createError(
      "El nombre del mensaje debe tener al menos 3 caracteres",
      "GHL_BROADCAST_SAVED_MESSAGE_NAME_INVALID",
    );
  }
  return { nombre, contenido: validateMessage(input.contenido) };
};

const serialize = (row) => {
  const value = row?.toJSON ? row.toJSON() : row;
  return {
    id: value.id,
    nombre: value.nombre,
    contenido: value.contenido,
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
    throw createError(
      "Ya existe un mensaje guardado con ese nombre",
      "GHL_BROADCAST_SAVED_MESSAGE_NAME_DUPLICATE",
      409,
    );
  }
};

const findSavedMessage = async (id, model = GhlDifusionMensaje) => {
  const parsedId = Number.parseInt(id, 10);
  if (!Number.isInteger(parsedId) || parsedId <= 0) {
    throw createError("Mensaje guardado no valido", "GHL_BROADCAST_SAVED_MESSAGE_ID_INVALID");
  }
  const row = await model.findByPk(parsedId);
  if (!row) {
    throw createError("Mensaje guardado no encontrado", "GHL_BROADCAST_SAVED_MESSAGE_NOT_FOUND", 404);
  }
  return row;
};

const listSavedMessages = async (dependencies = {}) => {
  const model = dependencies.model || GhlDifusionMensaje;
  const rows = await model.findAll({ order: [["nombre", "ASC"]] });
  return rows.map(serialize);
};

const createSavedMessage = async (input, userId, dependencies = {}) => {
  const model = dependencies.model || GhlDifusionMensaje;
  const payload = normalizePayload(input);
  await ensureUniqueName(model, payload.nombre);
  const row = await model.create({
    ...payload,
    creadoPorId: userId,
    actualizadoPorId: userId,
  });
  return serialize(row);
};

const updateSavedMessage = async (id, input, userId, dependencies = {}) => {
  const model = dependencies.model || GhlDifusionMensaje;
  const row = await findSavedMessage(id, model);
  const payload = normalizePayload(input);
  await ensureUniqueName(model, payload.nombre, row.id);
  await row.update({ ...payload, actualizadoPorId: userId });
  return serialize(row);
};

const deleteSavedMessage = async (id, dependencies = {}) => {
  const model = dependencies.model || GhlDifusionMensaje;
  const row = await findSavedMessage(id, model);
  await row.destroy();
  return { id: row.id };
};

module.exports = {
  createSavedMessage,
  deleteSavedMessage,
  listSavedMessages,
  normalizePayload,
  updateSavedMessage,
};
