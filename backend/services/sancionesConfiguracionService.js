const { Op } = require("sequelize");
const SancionConfiguracion = require("../models/SancionConfiguracion");
const RolPago = require("../models/RolPago");

const PERIODOS = ["SEMANAL", "MENSUAL", "RANGO"];
const errorConEstado = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const serializar = (row) => {
  const value = row.toJSON ? row.toJSON() : row;
  return { ...value, minimoUnidades: Number(value.minimoUnidades), valorMultaUnidad: Number(value.valorMultaUnidad) };
};

const normalizar = (payload = {}) => {
  const cargoReferencia = String(payload.cargoReferencia || "").trim().toUpperCase();
  const periodo = String(payload.periodo || "").trim().toUpperCase();
  const minimoUnidades = Number(payload.minimoUnidades);
  const valorMultaUnidad = Number(payload.valorMultaUnidad);
  const rolPagoId = payload.rolPagoId === "" || payload.rolPagoId == null ? null : Number(payload.rolPagoId);
  if (!cargoReferencia) throw errorConEstado("El cargo de referencia es obligatorio");
  if (!PERIODOS.includes(periodo)) throw errorConEstado("El periodo debe ser SEMANAL, MENSUAL o RANGO");
  if (!Number.isInteger(minimoUnidades) || minimoUnidades < 0) throw errorConEstado("El minimo de unidades debe ser un entero mayor o igual a cero");
  if (!Number.isFinite(valorMultaUnidad) || valorMultaUnidad < 0) throw errorConEstado("El valor de multa debe ser mayor o igual a cero");
  if (rolPagoId !== null && (!Number.isInteger(rolPagoId) || rolPagoId <= 0)) throw errorConEstado("El rol de pago no es valido");
  return { rolPagoId, cargoReferencia, periodo, minimoUnidades, valorMultaUnidad, descripcion: payload.descripcion ? String(payload.descripcion).trim() : null, activo: payload.activo === undefined ? true : Boolean(payload.activo) };
};

const include = [{ model: RolPago, as: "rolPago", attributes: ["id", "cargo", "nivel"], required: false }];
const listarSanciones = async ({ cargo, rolPagoId, periodo, activo = "true" } = {}) => {
  const where = {};
  if (cargo) where.cargoReferencia = { [Op.iLike]: `%${String(cargo).trim()}%` };
  if (rolPagoId) where.rolPagoId = Number(rolPagoId);
  if (periodo) where.periodo = String(periodo).toUpperCase();
  if (!["", "todos", "all"].includes(String(activo).toLowerCase())) where.activo = ["true", "1", "si", "sí"].includes(String(activo).toLowerCase());
  return (await SancionConfiguracion.findAll({ where, include, order: [["cargoReferencia", "ASC"], ["periodo", "ASC"]] })).map(serializar);
};
const obtenerSancion = async (id) => {
  const row = await SancionConfiguracion.findByPk(id, { include });
  if (!row) throw errorConEstado("Configuracion de sancion no encontrada", 404);
  return serializar(row);
};
const crearSancion = async (payload) => serializar(await SancionConfiguracion.create(normalizar(payload)));
const actualizarSancion = async (id, payload) => {
  const row = await SancionConfiguracion.findByPk(id);
  if (!row) throw errorConEstado("Configuracion de sancion no encontrada", 404);
  await row.update(normalizar({ ...row.toJSON(), ...payload }));
  return obtenerSancion(id);
};
const desactivarSancion = async (id) => {
  const row = await SancionConfiguracion.findByPk(id);
  if (!row) throw errorConEstado("Configuracion de sancion no encontrada", 404);
  await row.update({ activo: false });
  return obtenerSancion(id);
};
module.exports = { listarSanciones, obtenerSancion, crearSancion, actualizarSancion, desactivarSancion };
