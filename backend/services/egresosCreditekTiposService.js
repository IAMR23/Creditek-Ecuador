const { randomUUID } = require("crypto");
const Tipo = require("../models/EgresoCreditekTipo");

const error = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const seccionValida = (value) => {
  const seccion = String(value || "").toUpperCase();
  if (!["PRESTAMOS", "ANTICIPOS"].includes(seccion)) throw error("Seccion invalida");
  return seccion;
};
const nombreValido = (value) => {
  if (typeof value !== "string") throw error("Ingrese el nombre del tipo");
  const nombre = value.trim().replace(/\s+/g, " ");
  if (!nombre || nombre.length > 100) throw error("El nombre debe tener entre 1 y 100 caracteres");
  return { nombre, nombreClave: nombre.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() };
};
const manejarDuplicado = (e) => {
  if (e.name === "SequelizeUniqueConstraintError") throw error("Ya existe un tipo con ese nombre en esta seccion", 409);
  throw e;
};
const listar = async (seccion) => Tipo.findAll({ where: { seccion: seccionValida(seccion) }, order: [["nombre", "ASC"], ["id", "ASC"]] });
const crear = async (seccion, payload, usuarioId) => {
  try {
    return await Tipo.create({ seccion: seccionValida(seccion), codigo: `T_${randomUUID().replace(/-/g, "").slice(0, 28).toUpperCase()}`, ...nombreValido(payload.nombre), actualizadoPorId: usuarioId });
  } catch (e) { return manejarDuplicado(e); }
};
const actualizar = async (seccion, id, payload, usuarioId) => {
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId < 1) throw error("Tipo invalido");
  const row = await Tipo.findOne({ where: { id: numericId, seccion: seccionValida(seccion) } });
  if (!row) throw error("El tipo no existe en esta seccion", 404);
  const cambios = { actualizadoPorId: usuarioId };
  if (payload.nombre !== undefined) Object.assign(cambios, nombreValido(payload.nombre));
  if (payload.activo !== undefined) {
    if (typeof payload.activo !== "boolean") throw error("Estado invalido");
    cambios.activo = payload.activo;
  }
  if (payload.nombre === undefined && payload.activo === undefined) throw error("No hay cambios para guardar");
  try { return await row.update(cambios); } catch (e) { return manejarDuplicado(e); }
};
const validarTipo = async (seccion, codigo, codigoAnterior) => {
  const row = await Tipo.findOne({ where: { seccion: seccionValida(seccion), codigo } });
  if (!row || (!row.activo && codigo !== codigoAnterior)) throw error("Seleccione un tipo activo de esta seccion");
  return codigo;
};

module.exports = { listar, crear, actualizar, validarTipo };
