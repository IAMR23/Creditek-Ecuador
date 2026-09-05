const RolDescuentoCreditek = require("../models/RolDescuentoCreditek");
const Usuario = require("../models/Usuario");

const ESTADOS = ["PENDIENTE", "APLICADO", "RECURRENTE", "REVISAR"];
const error = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const idValido = (value) => {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) throw error("El usuario o registro no es válido");
  return id;
};
const periodoValido = (value) => {
  if (typeof value !== "string" || !/^(20\d{2}|2100)-(0[1-9]|1[0-2])$/.test(value)) {
    throw error("El mes debe tener formato YYYY-MM, entre 2000 y 2100");
  }
  return value;
};
const normalizarRegistro = (body = {}) => {
  const usuarioId = idValido(body.usuarioId);
  const motivo = typeof body.motivo === "string" ? body.motivo.trim() : "";
  if (!motivo || motivo.length > 200) throw error("Ingrese un motivo de hasta 200 caracteres");
  if (!Array.isArray(body.cuotas) || !body.cuotas.length || body.cuotas.length > 120) {
    throw error("Registre entre 1 y 120 cuotas mensuales");
  }
  const periodos = new Set();
  const cuotas = body.cuotas.map((cuota) => {
    const periodo = periodoValido(cuota?.periodo);
    if (periodos.has(periodo)) throw error("No repita el mes dentro del mismo motivo");
    periodos.add(periodo);
    const texto = String(cuota.valor ?? "").trim().replace(",", ".");
    if (!/^\d+(\.\d{1,2})?$/.test(texto)) throw error("Las cuotas deben tener como máximo dos decimales");
    const valor = Number(texto);
    if (!Number.isFinite(valor) || valor <= 0 || valor > 9999999999.99) {
      throw error("El valor de cada cuota debe ser mayor a cero y no superar 9.999.999.999,99");
    }
    const estado = cuota.estado || "PENDIENTE";
    if (!ESTADOS.includes(estado)) throw error("El estado de la cuota no es válido");
    return { periodo, valor, estado };
  }).sort((a, b) => a.periodo.localeCompare(b.periodo));
  return { usuarioId, motivo, cuotas };
};
const includeUsuario = [{ model: Usuario, as: "usuario", attributes: ["id", "nombre", "activo"] }];
const obtener = async ({ inicio, fin, archivados } = {}) => {
  periodoValido(inicio);
  periodoValido(fin);
  const indice = (mes) => Number(mes.slice(0, 4)) * 12 + Number(mes.slice(5));
  if (fin < inicio || indice(fin) - indice(inicio) > 23) throw error("Seleccione un rango de 1 a 24 meses");
  if (archivados !== undefined && !["true", "false"].includes(archivados)) throw error("El filtro de archivados no es válido");
  const [registros, usuarios] = await Promise.all([
    RolDescuentoCreditek.findAll({
      where: { activo: archivados !== "true" }, include: includeUsuario,
      order: [["usuario", "nombre", "ASC"], ["id", "ASC"]],
    }),
    Usuario.findAll({ where: { activo: true }, attributes: ["id", "nombre", "activo"], order: [["nombre", "ASC"]] }),
  ]);
  return {
    inicio, fin, usuarios,
    // Se conservan todas las cuotas al editar, incluso las que quedan fuera de la vista.
    registros: registros.filter((registro) => registro.cuotas.some((cuota) => cuota.periodo >= inicio && cuota.periodo <= fin)),
  };
};
const crear = async (body, actor) => {
  const values = normalizarRegistro(body);
  const usuario = await Usuario.findOne({ where: { id: values.usuarioId, activo: true }, attributes: ["id"] });
  if (!usuario) throw error("Seleccione un usuario activo");
  return RolDescuentoCreditek.create({ ...values, registradoPorId: idValido(actor), actualizadoPorId: idValido(actor) });
};
const actualizar = async (idValue, body, actor, soloEstado = false) => {
  const id = idValido(idValue);
  if (!Number.isInteger(body.version) || body.version < 0) throw error("La versión del registro no es válida");
  let values;
  if (soloEstado) {
    if (typeof body.activo !== "boolean") throw error("El estado activo debe ser verdadero o falso");
    values = { activo: body.activo };
  } else {
    values = normalizarRegistro(body);
    // Los descuentos históricos de usuarios inactivos siguen siendo editables.
    const usuario = await Usuario.findByPk(values.usuarioId, { attributes: ["id"] });
    if (!usuario) throw error("El usuario no existe");
  }
  const [cantidad] = await RolDescuentoCreditek.update({
    ...values, version: body.version + 1, actualizadoPorId: idValido(actor),
  }, { where: { id, version: body.version } });
  if (!cantidad) throw error("El registro cambió o ya no existe. Actualice la tabla antes de editarlo", 409);
  return { message: "Descuento guardado correctamente" };
};

module.exports = { obtener, crear, actualizar, normalizarRegistro, periodoValido };
