const { Op } = require('sequelize');
const { sequelize } = require('../config/db');
const Usuario = require('../models/Usuario');
const NominaNovedad = require('../models/NominaNovedad');
const { validarNovedad, validarPeriodo, novedadesDelMes, calcularNominaPeriodo } = require('../utils/nominaNovedades');
const fallo = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const idValido = (value) => {
  const id = Number(value);
  if (!Number.isInteger(id) || id < 1) throw fallo('Identificador inválido');
  return id;
};
const plain = (row) => row?.toJSON ? row.toJSON() : row;
const consultar = async (where) => {
  try {
    return { disponible: true, registros: (await NominaNovedad.findAll({ where, order: [['fechaInicio', 'DESC'], ['id', 'DESC']] })).map(plain) };
  } catch (error) {
    // Permite desplegar el código antes del SQL sin interrumpir las nóminas existentes.
    if (error.original?.code === '42P01') return { disponible: false, registros: [] };
    throw error;
  }
};
const listar = (usuarioId) => consultar({ usuarioId: idValido(usuarioId) });
const listarPeriodo = ({ anio, mes }) => {
  const key = validarPeriodo({ anio, mes });
  const fin = new Date(Date.UTC(Number(anio), Number(mes), 0)).toISOString().slice(0, 10);
  return consultar({ activo: true, fechaInicio: { [Op.lte]: fin }, fechaFin: { [Op.gte]: `${key}-01` } });
};
const preparar = (payload, actual) => {
  const valores = validarNovedad(payload);
  if (actual && Number(actual.usuarioId) !== valores.usuarioId) {
    throw fallo('No se puede cambiar el empleado de una novedad existente');
  }
  // Conserva el historial existente sin aceptar nuevos ajustes de días ni usarlos al calcular.
  return { ...valores, ajustesMensuales: actual?.ajustesMensuales || {} };
};
const validarConjunto = (candidato, registros, periodo) => {
  const otras = registros.filter((item) => Number(item.id) !== Number(candidato.id));
  if (candidato.activo && candidato.tipo === 'MATERNIDAD' && otras.some((item) =>
    item.activo && item.tipo === 'MATERNIDAD' && item.fechaInicio <= candidato.fechaFin && item.fechaFin >= candidato.fechaInicio)) {
    throw fallo('Ya existe una novedad de maternidad superpuesta para esta persona');
  }
  const conjunto = [...otras, candidato];
  calcularNominaPeriodo({}, periodo, conjunto);
  return conjunto;
};
const guardar = async (payload, actorValue, novedadId) => {
  const actor = idValido(actorValue);
  const valores = validarNovedad(payload);
  const id = novedadId == null ? null : idValido(novedadId);
  try {
    return await sequelize.transaction(async (transaction) => {
      // El bloqueo por empleado impide dos altas simultáneas que se superpongan.
      const usuario = await Usuario.findByPk(valores.usuarioId, { transaction, lock: transaction.LOCK.UPDATE });
      if (!usuario) throw fallo('Empleado no encontrado', 404);
      const actual = id == null ? null : await NominaNovedad.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
      if (id != null && !actual) throw fallo('Novedad no encontrada', 404);
      const candidato = { ...preparar(payload, plain(actual)), ...(id == null ? {} : { id }) };
      const registros = (await NominaNovedad.findAll({ where: { usuarioId: valores.usuarioId, activo: true }, transaction })).map(plain);
      validarConjunto(candidato, registros, payload);
      const cambios = { ...candidato, actualizadoPorId: actor };
      const registro = actual ? await actual.update(cambios, { transaction })
        : await NominaNovedad.create({ ...cambios, creadoPorId: actor }, { transaction });
      return plain(registro);
    });
  } catch (error) {
    if (error.original?.code === '42P01') throw fallo('Primero debe aplicarse la migración de novedades de nómina', 503);
    if (error.original?.code === '23514') throw fallo('La novedad tiene días, fechas o una superposición inválidos');
    throw error;
  }
};
const vistaPrevia = async (payload) => {
  const valores = validarNovedad(payload);
  const { disponible, registros } = await listar(valores.usuarioId);
  if (!disponible) throw fallo('Primero debe aplicarse la migración de novedades de nómina', 503);
  const id = payload.id == null ? null : idValido(payload.id);
  const actual = id == null ? null : registros.find((row) => Number(row.id) === id);
  if (id != null && !actual) throw fallo('Novedad no encontrada', 404);
  const candidato = { ...preparar(payload, actual), ...(id == null ? {} : { id }) };
  const conjunto = validarConjunto(candidato, registros, payload);
  // Se usan sueldo, fondos históricos y descuentos del servidor; no importes enviados por el cliente.
  const { obtenerResumen, normalizarValor } = require('./rolesCreditekResumenService');
  const resumen = await obtenerResumen({ anio: payload.anio, mes: payload.mes });
  const row = resumen.registros.find((item) => item.usuarioId === valores.usuarioId);
  if (!row) throw fallo('El empleado no aparece en la nómina del período', 404);
  const ajustes = {};
  for (const campo of ['fondosReservaManual', 'sueldosExtrasManual']) {
    if (Object.hasOwn(payload.ajustesNomina || {}, campo)) {
      ajustes[campo] = normalizarValor(payload.ajustesNomina[campo], campo);
    }
  }
  return { calculo: calcularNominaPeriodo({ ...row, ...ajustes }, payload, conjunto), novedades: novedadesDelMes(conjunto, payload) };
};
module.exports = { listar, listarPeriodo, guardar, vistaPrevia, validarConjunto };
