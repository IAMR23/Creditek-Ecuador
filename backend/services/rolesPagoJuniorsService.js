const { Op } = require("sequelize");
const RolPago = require("../models/RolPago");
const RolPagoJunior = require("../models/RolPagoJunior");

const crearError = (message, statusCode = 400) =>
  Object.assign(new Error(message), { statusCode });

const idValido = (value, label) => {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw crearError(`${label} no es válido`);
  return id;
};

const serializar = (row) => {
  const value = typeof row?.toJSON === "function" ? row.toJSON() : row;
  return {
    id: Number(value.id),
    cargoRolPagoId: Number(value.cargoRolPagoId),
    juniorRolPagoId: Number(value.juniorRolPagoId),
    activo: value.activo !== false,
    cargo: value.cargo || null,
    junior: value.junior || null,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
};

const includeCargos = [
  { model: RolPago, as: "cargo", attributes: ["id", "nivel", "cargo", "activo"] },
  { model: RolPago, as: "junior", attributes: ["id", "nivel", "cargo", "activo"] },
];

const listar = async ({ activo = "true" } = {}) => {
  const where = {};
  if (!['', 'todos', 'all'].includes(String(activo).toLowerCase())) {
    where.activo = ['true', '1', 'si', 'sí'].includes(String(activo).toLowerCase());
  }
  const rows = await RolPagoJunior.findAll({
    where,
    include: includeCargos,
    order: [
      [{ model: RolPago, as: "cargo" }, "cargo", "ASC"],
      [{ model: RolPago, as: "junior" }, "cargo", "ASC"],
    ],
  });
  return rows.map(serializar);
};

const validarCargos = async (cargoRolPagoId, juniorRolPagoId) => {
  if (cargoRolPagoId === juniorRolPagoId) {
    throw crearError("Un cargo no puede ser junior de sí mismo");
  }
  const cargos = await RolPago.findAll({
    where: { id: { [Op.in]: [cargoRolPagoId, juniorRolPagoId] } },
    attributes: ["id", "activo"],
  });
  if (cargos.length !== 2) throw crearError("Uno o ambos cargos no existen", 404);
  if (cargos.some((cargo) => cargo.activo === false)) {
    throw crearError("Los dos cargos deben estar activos");
  }
};

const validarSinCiclo = async (cargoRolPagoId, juniorRolPagoId, excluirId = null) => {
  const where = { activo: true };
  if (excluirId) where.id = { [Op.ne]: excluirId };
  const relaciones = await RolPagoJunior.findAll({
    where,
    attributes: ["cargoRolPagoId", "juniorRolPagoId"],
    raw: true,
  });
  const enlaces = new Map();
  relaciones.forEach((item) => {
    const origen = Number(item.cargoRolPagoId);
    if (!enlaces.has(origen)) enlaces.set(origen, []);
    enlaces.get(origen).push(Number(item.juniorRolPagoId));
  });
  if (!enlaces.has(cargoRolPagoId)) enlaces.set(cargoRolPagoId, []);
  enlaces.get(cargoRolPagoId).push(juniorRolPagoId);

  const pendientes = [juniorRolPagoId];
  const visitados = new Set();
  while (pendientes.length) {
    const actual = pendientes.pop();
    if (actual === cargoRolPagoId) {
      throw crearError("La relación generaría un ciclo entre cargos");
    }
    if (visitados.has(actual)) continue;
    visitados.add(actual);
    pendientes.push(...(enlaces.get(actual) || []));
  }
};

const crear = async (payload = {}) => {
  const cargoRolPagoId = idValido(payload.cargoRolPagoId, "El cargo principal");
  const juniorRolPagoId = idValido(payload.juniorRolPagoId, "El cargo junior");
  await validarCargos(cargoRolPagoId, juniorRolPagoId);
  await validarSinCiclo(cargoRolPagoId, juniorRolPagoId);

  const existente = await RolPagoJunior.findOne({
    where: { cargoRolPagoId, juniorRolPagoId },
  });
  if (existente) {
    if (existente.activo !== false) throw crearError("La relación ya existe", 409);
    await existente.update({ activo: true });
    return serializar(await RolPagoJunior.findByPk(existente.id, { include: includeCargos }));
  }
  const creado = await RolPagoJunior.create({ cargoRolPagoId, juniorRolPagoId, activo: true });
  return serializar(await RolPagoJunior.findByPk(creado.id, { include: includeCargos }));
};

const cambiarEstado = async (idValue, activo) => {
  const id = idValido(idValue, "La relación");
  const relacion = await RolPagoJunior.findByPk(id);
  if (!relacion) throw crearError("Relación no encontrada", 404);
  if (activo) {
    await validarCargos(Number(relacion.cargoRolPagoId), Number(relacion.juniorRolPagoId));
    await validarSinCiclo(Number(relacion.cargoRolPagoId), Number(relacion.juniorRolPagoId), id);
  }
  await relacion.update({ activo: Boolean(activo) });
  return serializar(await RolPagoJunior.findByPk(id, { include: includeCargos }));
};

module.exports = { listar, crear, cambiarEstado };
