const { Op } = require("sequelize");
const ComisionConfiguracion = require("../models/ComisionConfiguracion");
const RolPago = require("../models/RolPago");

const toNumberOrNull = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const serializarComision = (comision) => ({
  id: comision.id,
  rolPagoId: comision.rolPagoId || null,
  rolPago: comision.rolPago || null,
  grupo: comision.grupo,
  subgrupo: comision.subgrupo || "",
  periodo: comision.periodo,
  unidadesVendidas: comision.unidadesVendidas || "",
  comisionPorEquipo:
    comision.comisionPorEquipo === null ? null : Number(comision.comisionPorEquipo),
  porcentaje: comision.porcentaje === null ? null : Number(comision.porcentaje),
  promedioPorVendedor: comision.promedioPorVendedor || "",
  bono: comision.bono === null ? null : Number(comision.bono),
  valorAproximado: comision.valorAproximado || "",
  notas: comision.notas || "",
  orden: Number(comision.orden || 0),
  activo: Boolean(comision.activo),
  createdAt: comision.createdAt,
  updatedAt: comision.updatedAt,
});

const normalizarPayload = async (payload = {}) => {
  const rolPagoId = Number(payload.rolPagoId);
  const periodo = String(payload.periodo || "").trim();

  if (!Number.isInteger(rolPagoId) || rolPagoId <= 0) {
    const error = new Error("Debe seleccionar un cargo de Roles de Pago");
    error.statusCode = 400;
    throw error;
  }
  const rolPago = await RolPago.findOne({ where: { id: rolPagoId, activo: true } });
  if (!rolPago) {
    const error = new Error("El rol de pago seleccionado no existe o esta inactivo");
    error.statusCode = 400;
    throw error;
  }
  if (!periodo) throw new Error("El periodo es obligatorio");

  return {
    rolPagoId,
    grupo: rolPago.cargo,
    subgrupo: payload.subgrupo ? String(payload.subgrupo).trim() : null,
    periodo,
    unidadesVendidas: payload.unidadesVendidas
      ? String(payload.unidadesVendidas).trim()
      : null,
    comisionPorEquipo: toNumberOrNull(payload.comisionPorEquipo),
    porcentaje: toNumberOrNull(payload.porcentaje),
    promedioPorVendedor: payload.promedioPorVendedor
      ? String(payload.promedioPorVendedor).trim()
      : null,
    bono: toNumberOrNull(payload.bono),
    valorAproximado: payload.valorAproximado
      ? String(payload.valorAproximado).trim()
      : null,
    notas: payload.notas ? String(payload.notas).trim() : null,
    orden: Number(payload.orden || 0),
    activo: payload.activo === undefined ? true : Boolean(payload.activo),
  };
};

const listarComisiones = async ({
  grupo,
  rolPagoId,
  periodo,
  activo = "true",
  q,
} = {}) => {
  const where = {};

  if (grupo) where.grupo = String(grupo).trim();
  if (rolPagoId) where.rolPagoId = Number(rolPagoId);
  if (periodo) where.periodo = String(periodo).trim();
  if (q) {
    const term = `%${String(q).trim()}%`;
    where[Op.or] = [
      { grupo: { [Op.iLike]: term } },
      { subgrupo: { [Op.iLike]: term } },
      { unidadesVendidas: { [Op.iLike]: term } },
      { valorAproximado: { [Op.iLike]: term } },
      { notas: { [Op.iLike]: term } },
    ];
  }
  if (activo !== "" && activo !== "todos" && activo !== "all") {
    where.activo = ["true", "1", "si", "sí"].includes(
      String(activo).trim().toLowerCase(),
    );
  }

  const registros = await ComisionConfiguracion.findAll({
    where,
    include: [{ model: RolPago, as: "rolPago", attributes: ["id", "cargo", "nivel"], required: false }],
    order: [
      ["grupo", "ASC"],
      ["periodo", "ASC"],
      ["orden", "ASC"],
      ["id", "ASC"],
    ],
  });

  return registros.map(serializarComision);
};

const obtenerComision = async (id) => {
  const comision = await ComisionConfiguracion.findByPk(id, { include: [{ model: RolPago, as: "rolPago", attributes: ["id", "cargo", "nivel"], required: false }] });

  if (!comision) {
    const error = new Error("Configuracion de comision no encontrada");
    error.statusCode = 404;
    throw error;
  }

  return serializarComision(comision);
};

const crearComision = async (payload) => {
  const data = await normalizarPayload(payload);
  return serializarComision(await ComisionConfiguracion.create(data));
};

const actualizarComision = async (id, payload) => {
  const comision = await ComisionConfiguracion.findByPk(id);

  if (!comision) {
    const error = new Error("Configuracion de comision no encontrada");
    error.statusCode = 404;
    throw error;
  }

  const data = await normalizarPayload({ ...comision.toJSON(), ...payload });
  await comision.update(data);
  return serializarComision(comision);
};

const desactivarComision = async (id) => {
  const comision = await ComisionConfiguracion.findByPk(id);

  if (!comision) {
    const error = new Error("Configuracion de comision no encontrada");
    error.statusCode = 404;
    throw error;
  }

  await comision.update({ activo: false });
  return serializarComision(comision);
};

module.exports = {
  listarComisiones,
  obtenerComision,
  crearComision,
  actualizarComision,
  desactivarComision,
};
