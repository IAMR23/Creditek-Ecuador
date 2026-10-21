const { Op, fn, col, where } = require("sequelize");
const Categoria = require("../models/GhlDifusionCategoria");

const compactString = (value) => String(value || "").trim().replace(/\s+/g, " ");

const createError = (message, code, statusCode = 400) => {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
};

const normalizeName = (value) => {
  const nombre = compactString(value).slice(0, 80);
  if (nombre.length < 2) {
    throw createError("La categoria debe tener al menos 2 caracteres", "GHL_BROADCAST_CATEGORY_NAME_INVALID");
  }
  return nombre;
};

const serialize = (row) => {
  const value = row?.toJSON ? row.toJSON() : row;
  return {
    id: value.id,
    nombre: value.nombre,
    creadoPorId: value.creadoPorId,
    actualizadoPorId: value.actualizadoPorId,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
};

const ensureUnique = async (model, nombre, excludedId = null) => {
  const duplicate = await model.findOne({
    where: {
      ...(excludedId ? { id: { [Op.ne]: excludedId } } : {}),
      [Op.and]: where(fn("LOWER", fn("TRIM", col("nombre"))), nombre.toLowerCase()),
    },
  });
  if (duplicate) throw createError("Ya existe una categoria con ese nombre", "GHL_BROADCAST_CATEGORY_DUPLICATE", 409);
};

const findCategory = async (id, model = Categoria) => {
  const parsedId = Number.parseInt(id, 10);
  if (!Number.isInteger(parsedId) || parsedId <= 0) {
    throw createError("Categoria no valida", "GHL_BROADCAST_CATEGORY_ID_INVALID");
  }
  const row = await model.findByPk(parsedId);
  if (!row) throw createError("Categoria no encontrada", "GHL_BROADCAST_CATEGORY_NOT_FOUND", 404);
  return row;
};

const listCategories = async (dependencies = {}) => {
  const model = dependencies.model || Categoria;
  return (await model.findAll({ order: [["nombre", "ASC"]] })).map(serialize);
};

const createCategory = async (input, userId, dependencies = {}) => {
  const model = dependencies.model || Categoria;
  const nombre = normalizeName(input?.nombre);
  await ensureUnique(model, nombre);
  return serialize(await model.create({ nombre, creadoPorId: userId, actualizadoPorId: userId }));
};

const updateCategory = async (id, input, userId, dependencies = {}) => {
  const model = dependencies.model || Categoria;
  const row = await findCategory(id, model);
  const nombre = normalizeName(input?.nombre);
  await ensureUnique(model, nombre, row.id);
  await row.update({ nombre, actualizadoPorId: userId });
  return serialize(row);
};

const deleteCategory = async (id, dependencies = {}) => {
  const model = dependencies.model || Categoria;
  const row = await findCategory(id, model);
  await row.destroy();
  return { id: row.id };
};

module.exports = {
  createCategory,
  deleteCategory,
  listCategories,
  normalizeName,
  updateCategory,
};
