const { Op } = require("sequelize");
const RolPago = require("../models/RolPago");

const toNumberOrNull = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const toMoney = (value) => {
  const number = toNumberOrNull(value);
  return number === null ? 0 : number;
};

const serializarRolPago = (rolPago) => {
  const sueldoBase = Number(rolPago.sueldoBase || 0);
  const sueldoExtra = Number(rolPago.sueldoExtra || 0);

  return {
    id: rolPago.id,
    nivel: rolPago.nivel,
    cargo: rolPago.cargo,
    descripcion: rolPago.descripcion || "",
    sueldoBase,
    sueldoExtra,
    sueldoTotal: Number((sueldoBase + sueldoExtra).toFixed(2)),
    comisiones: rolPago.comisiones ?? null,
    ingresoMin: rolPago.ingresoMin === null ? null : Number(rolPago.ingresoMin),
    ingresoMax: rolPago.ingresoMax === null ? null : Number(rolPago.ingresoMax),
    activo: Boolean(rolPago.activo),
    createdAt: rolPago.createdAt,
    updatedAt: rolPago.updatedAt,
  };
};

const normalizarPayload = (payload = {}) => {
  const nivel = String(payload.nivel || "").trim();
  const cargo = String(payload.cargo || "").trim();

  if (!nivel) throw new Error("El nivel es obligatorio");
  if (!cargo) throw new Error("El cargo es obligatorio");

  return {
    nivel,
    cargo,
    descripcion: payload.descripcion ?? null,
    sueldoBase: toMoney(payload.sueldoBase),
    sueldoExtra: toMoney(payload.sueldoExtra),
    comisiones:
      payload.comisiones === undefined ||
      payload.comisiones === null ||
      String(payload.comisiones).trim() === ""
        ? null
        : String(payload.comisiones).trim(),
    ingresoMin: toNumberOrNull(payload.ingresoMin),
    ingresoMax: toNumberOrNull(payload.ingresoMax),
    activo: payload.activo === undefined ? true : Boolean(payload.activo),
  };
};

const listarRolesPago = async ({ nivel, cargo, activo = "true" } = {}) => {
  const where = {};

  if (nivel) where.nivel = String(nivel).trim();
  if (cargo) where.cargo = { [Op.iLike]: `%${String(cargo).trim()}%` };
  if (activo !== "" && activo !== "todos" && activo !== "all") {
    where.activo = ["true", "1", "si", "sí"].includes(
      String(activo).trim().toLowerCase(),
    );
  }

  const roles = await RolPago.findAll({
    where,
    order: [
      ["nivel", "ASC"],
      ["cargo", "ASC"],
    ],
  });

  return roles.map(serializarRolPago);
};

const obtenerRolPago = async (id) => {
  const rolPago = await RolPago.findByPk(id);

  if (!rolPago) {
    const error = new Error("Rol de pago no encontrado");
    error.statusCode = 404;
    throw error;
  }

  return serializarRolPago(rolPago);
};

const crearRolPago = async (payload) => {
  const data = normalizarPayload(payload);
  const existente = await RolPago.findOne({ where: { cargo: data.cargo } });

  if (existente) {
    const error = new Error("Ya existe un rol de pago con ese cargo");
    error.statusCode = 409;
    throw error;
  }

  return serializarRolPago(await RolPago.create(data));
};

const actualizarRolPago = async (id, payload) => {
  const rolPago = await RolPago.findByPk(id);

  if (!rolPago) {
    const error = new Error("Rol de pago no encontrado");
    error.statusCode = 404;
    throw error;
  }

  const data = normalizarPayload({ ...rolPago.toJSON(), ...payload });
  const duplicado = await RolPago.findOne({
    where: {
      cargo: data.cargo,
      id: { [Op.ne]: rolPago.id },
    },
  });

  if (duplicado) {
    const error = new Error("Ya existe otro rol de pago con ese cargo");
    error.statusCode = 409;
    throw error;
  }

  await rolPago.update(data);
  return serializarRolPago(rolPago);
};

const desactivarRolPago = async (id) => {
  const rolPago = await RolPago.findByPk(id);

  if (!rolPago) {
    const error = new Error("Rol de pago no encontrado");
    error.statusCode = 404;
    throw error;
  }

  await rolPago.update({ activo: false });
  return serializarRolPago(rolPago);
};

module.exports = {
  serializarRolPago,
  listarRolesPago,
  obtenerRolPago,
  crearRolPago,
  actualizarRolPago,
  desactivarRolPago,
};
