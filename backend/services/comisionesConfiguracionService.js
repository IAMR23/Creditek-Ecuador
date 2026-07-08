const { Op } = require("sequelize");
const ComisionConfiguracion = require("../models/ComisionConfiguracion");

const toNumberOrNull = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const serializarComision = (comision) => ({
  id: comision.id,
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

const normalizarPayload = (payload = {}) => {
  const grupo = String(payload.grupo || "").trim();
  const periodo = String(payload.periodo || "").trim();

  if (!grupo) throw new Error("El grupo es obligatorio");
  if (!periodo) throw new Error("El periodo es obligatorio");

  return {
    grupo,
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
  periodo,
  activo = "true",
  q,
} = {}) => {
  const where = {};

  if (grupo) where.grupo = String(grupo).trim();
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
  const comision = await ComisionConfiguracion.findByPk(id);

  if (!comision) {
    const error = new Error("Configuracion de comision no encontrada");
    error.statusCode = 404;
    throw error;
  }

  return serializarComision(comision);
};

const crearComision = async (payload) => {
  const data = normalizarPayload(payload);
  return serializarComision(await ComisionConfiguracion.create(data));
};

const actualizarComision = async (id, payload) => {
  const comision = await ComisionConfiguracion.findByPk(id);

  if (!comision) {
    const error = new Error("Configuracion de comision no encontrada");
    error.statusCode = 404;
    throw error;
  }

  const data = normalizarPayload({ ...comision.toJSON(), ...payload });
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
