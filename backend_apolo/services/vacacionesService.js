const { Op, Transaction } = require("sequelize");
const { sequelize } = require("../config/db");
const Usuario = require("../models/Usuario");
const UsuarioAgencia = require("../models/UsuarioAgencia");
const VacacionPeriodo = require("../models/VacacionPeriodo");
const VacacionMovimiento = require("../models/VacacionMovimiento");
const VacacionSolicitud = require("../models/VacacionSolicitud");
const VacacionSolicitudPeriodo = require("../models/VacacionSolicitudPeriodo");
const VacacionHistorial = require("../models/VacacionHistorial");
const VacacionPago = require("../models/VacacionPago");
const VacacionPagoPeriodo = require("../models/VacacionPagoPeriodo");
const {
  contarDiasCalendario, hoyGuayaquil, resumenMovimientos, siguienteDia,
  validarAsignaciones, validarPeriodoAniversario,
} = require("./vacacionesDomain");

const errorHttp = (status, code, message, extra = {}) => Object.assign(new Error(message), { status, code, extra });
const actorId = (actor) => Number(actor?.id);
const decimal = (value) => Number(Number(value || 0).toFixed(2));

const obtenerSaldos = async (usuarioId, transaction = null, lock = false) => {
  const periodos = await VacacionPeriodo.findAll({
    where: { usuarioId },
    include: [{ model: VacacionMovimiento, as: "movimientos", required: false }],
    order: [["fechaInicio", "ASC"]], transaction,
    ...(lock && transaction ? { lock: transaction.LOCK.UPDATE } : {}),
  });
  return periodos.map((periodo) => ({ ...periodo.toJSON(), ...resumenMovimientos(periodo.movimientos || []) }));
};

const crearMovimientos = (items, transaction) => VacacionMovimiento.bulkCreate(items, { transaction });

const crearPeriodo = async (payload, actor) => sequelize.transaction(async (transaction) => {
  if (!payload.usuarioId || !payload.fechaInicio || !payload.fechaFin) throw errorHttp(400, "PERIODO_INCOMPLETO", "usuarioId, fechaInicio y fechaFin son obligatorios.");
  const usuario = await Usuario.findByPk(payload.usuarioId, { transaction, lock: transaction.LOCK.UPDATE });
  if (!usuario?.fechaIngreso) throw errorHttp(400, "FECHA_INGRESO_REQUERIDA", "El colaborador debe tener fecha de ingreso.");
  const estado = validarPeriodoAniversario({ fechaIngreso: usuario.fechaIngreso, fechaInicio: payload.fechaInicio, fechaFin: payload.fechaFin });
  const periodoSuperpuesto = await VacacionPeriodo.findOne({
    where: { usuarioId: usuario.id, fechaInicio: { [Op.lte]: payload.fechaFin }, fechaFin: { [Op.gte]: payload.fechaInicio } },
    transaction,
  });
  if (periodoSuperpuesto) throw errorHttp(409, "PERIODO_SUPERPUESTO", "Ya existe un período laboral que se superpone; no se duplicaron créditos.");
  const ordinarios = decimal(payload.diasOrdinarios);
  const adicionales = decimal(payload.diasAdicionales);
  const historicos = decimal(payload.diasDisfrutadosHistoricos);
  if ([ordinarios, adicionales, historicos].some((n) => n < 0)) throw errorHttp(400, "DIAS_INVALIDOS", "Los días no pueden ser negativos.");
  if (estado === "FORMACION" && (ordinarios || adicionales)) {
    throw errorHttp(400, "PERIODO_NO_CUMPLIDO", "Un período en formación no puede reconocer todavía el año completo.");
  }
  const anioServicio = Number(payload.fechaInicio.slice(0, 4)) - Number(String(usuario.fechaIngreso).slice(0, 4)) + 1;
  const adicionalesLegales = Math.min(15, Math.max(0, anioServicio - 5));
  if (adicionales > adicionalesLegales) {
    throw errorHttp(400, "ADICIONALES_ANTIGUEDAD_INVALIDOS", `Para este año de servicio corresponden hasta ${adicionalesLegales} días adicionales por antigüedad.`);
  }
  if (historicos > ordinarios + adicionales) throw errorHttp(400, "HISTORICO_EXCEDE_RECONOCIDO", "El histórico disfrutado excede los días reconocidos del período.");
  const periodo = await VacacionPeriodo.create({
    usuarioId: usuario.id, fechaInicio: payload.fechaInicio, fechaFin: payload.fechaFin,
    estado, fechaCorte: payload.fechaCorte || hoyGuayaquil(), observacion: payload.observacion || null,
    creadoPorId: actorId(actor),
  }, { transaction });
  const base = { periodoId: periodo.id, fechaEfectiva: periodo.fechaCorte, creadoPorId: actorId(actor), origenTipo: "CARGA_PERIODO" };
  const movimientos = [];
  if (ordinarios) movimientos.push({ ...base, categoria: "RECONOCIDO_ORDINARIO", dias: ordinarios, motivo: "Reconocimiento ordinario registrado por RRHH", origenId: `${periodo.id}:ordinario` });
  if (adicionales) movimientos.push({ ...base, categoria: "RECONOCIDO_ADICIONAL", dias: adicionales, motivo: "Reconocimiento adicional por antigüedad registrado por RRHH", origenId: `${periodo.id}:adicional` });
  if (historicos) movimientos.push({ ...base, categoria: "DISFRUTADO", dias: historicos, motivo: payload.motivoHistorico || "Vacaciones disfrutadas históricamente", origenId: `${periodo.id}:historico` });
  if (movimientos.length) await crearMovimientos(movimientos, transaction);
  return periodo;
});

const crearAjuste = async (periodoId, payload, actor) => sequelize.transaction(async (transaction) => {
  const periodo = await VacacionPeriodo.findByPk(periodoId, { transaction, lock: transaction.LOCK.UPDATE });
  if (!periodo) throw errorHttp(404, "PERIODO_NO_ENCONTRADO", "Período no encontrado.");
  const categorias = new Set(["RECONOCIDO_ORDINARIO", "RECONOCIDO_ADICIONAL", "DISFRUTADO"]);
  if (!categorias.has(payload.categoria)) throw errorHttp(400, "CATEGORIA_INVALIDA", "Categoría de ajuste inválida.");
  const dias = decimal(payload.dias);
  if (!dias || !String(payload.motivo || "").trim()) throw errorHttp(400, "AJUSTE_INVALIDO", "El ajuste requiere días distintos de cero y motivo.");
  const movimientosActuales = await VacacionMovimiento.findAll({ where: { periodoId: periodo.id }, transaction });
  const simulado = resumenMovimientos([...movimientosActuales, { categoria: payload.categoria, dias }]);
  if (simulado.disponibles < 0 || simulado.reconocidosOrdinarios < 0 || simulado.reconocidosAdicionales < 0 || simulado.disfrutados < 0) {
    throw errorHttp(409, "AJUSTE_DEJA_SALDO_INVALIDO", "El ajuste dejaría un saldo o acumulado negativo.");
  }
  return VacacionMovimiento.create({
    periodoId: periodo.id, categoria: payload.categoria, dias, motivo: payload.motivo.trim(),
    fechaEfectiva: payload.fechaCorte || hoyGuayaquil(), origenTipo: "AJUSTE",
    origenId: payload.idempotenciaKey || `ajuste:${Date.now()}:${actorId(actor)}`, creadoPorId: actorId(actor),
  }, { transaction });
});

const validarColaboradorAgencia = async (usuarioId, agenciaId, transaction) => {
  const relacion = await UsuarioAgencia.findOne({ where: { usuarioId, agenciaId }, transaction });
  if (!relacion) throw errorHttp(400, "AGENCIA_NO_ASIGNADA", "La agencia/departamento no está asignada al colaborador.");
};

const buscarSuperposicion = (usuarioId, fechaInicio, fechaFin, excludeId, transaction) => VacacionSolicitud.findOne({
  where: {
    usuarioId, estado: { [Op.in]: ["PENDIENTE", "APROBADA"] },
    fechaInicio: { [Op.lte]: fechaFin }, fechaFin: { [Op.gte]: fechaInicio },
    ...(excludeId ? { id: { [Op.ne]: excludeId } } : {}),
  }, transaction,
});

const crearSolicitud = async (payload, actor) => sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE }, async (transaction) => {
  if (!payload.usuarioId || !payload.agenciaId || !payload.fechaInicio || !payload.fechaFin) throw errorHttp(400, "SOLICITUD_INCOMPLETA", "Colaborador, unidad, inicio y último día son obligatorios.");
  if (payload.idempotenciaKey) {
    const existente = await VacacionSolicitud.findOne({ where: { idempotenciaKey: payload.idempotenciaKey }, transaction });
    if (existente) return existente;
  }
  const usuario = await Usuario.findByPk(payload.usuarioId, { transaction, lock: transaction.LOCK.UPDATE });
  if (!usuario) throw errorHttp(404, "USUARIO_NO_ENCONTRADO", "Colaborador no encontrado.");
  if (payload.fechaInicio < usuario.fechaIngreso || (usuario.fechaSalida && payload.fechaFin > usuario.fechaSalida)) {
    throw errorHttp(400, "FUERA_RELACION_LABORAL", "Las fechas quedan fuera de la relación laboral.");
  }
  const fechaReincorporacion = payload.fechaReincorporacion || siguienteDia(payload.fechaFin);
  if (fechaReincorporacion <= payload.fechaFin) throw errorHttp(400, "REINCORPORACION_INVALIDA", "La reincorporación debe ser posterior al último día incluido.");
  if (payload.reemplazoUsuarioId && Number(payload.reemplazoUsuarioId) === Number(usuario.id)) throw errorHttp(400, "REEMPLAZO_INVALIDO", "El colaborador no puede reemplazarse a sí mismo.");
  const conteo = contarDiasCalendario(payload.fechaInicio, payload.fechaFin);
  if (conteo !== Number(payload.cantidadDias)) throw errorHttp(400, "CONTEO_DIAS_INVALIDO", `El rango equivale a ${conteo} días calendario incluidos los no laborables.`);
  await validarColaboradorAgencia(usuario.id, payload.agenciaId, transaction);
  if (await buscarSuperposicion(usuario.id, payload.fechaInicio, payload.fechaFin, null, transaction)) {
    throw errorHttp(409, "SOLICITUD_SUPERPUESTA", "Existe otra solicitud pendiente o aprobada que se superpone para este colaborador.");
  }
  const saldos = await obtenerSaldos(usuario.id, transaction, true);
  validarAsignaciones({ asignaciones: payload.periodos, cantidadDias: payload.cantidadDias, periodos: saldos, motivoPrioridad: payload.motivoPrioridad });
  const saldoPorId = new Map(saldos.map((item) => [Number(item.id), item]));
  for (const asignacion of payload.periodos) {
    const saldo = saldoPorId.get(Number(asignacion.periodoId));
    if (!saldo || saldo.estado !== "CUMPLIDO" || Number(asignacion.dias) > saldo.disponibles) {
      throw errorHttp(409, "SALDO_INSUFICIENTE", "Uno de los períodos no tiene saldo cumplido suficiente.");
    }
  }
  const solicitud = await VacacionSolicitud.create({
    usuarioId: usuario.id, agenciaId: payload.agenciaId, cantidadDias: conteo,
    fechaInicio: payload.fechaInicio, fechaFin: payload.fechaFin,
    fechaReincorporacion,
    observacion: payload.observacion || null, reemplazoUsuarioId: payload.reemplazoUsuarioId || null,
    motivoPrioridad: payload.motivoPrioridad || null, autorId: actorId(actor), idempotenciaKey: payload.idempotenciaKey || null,
  }, { transaction });
  await VacacionSolicitudPeriodo.bulkCreate(payload.periodos.map((item, index) => ({ solicitudId: solicitud.id, periodoId: item.periodoId, dias: item.dias, orden: index + 1 })), { transaction });
  await VacacionHistorial.create({ solicitudId: solicitud.id, accion: "CREADA", estadoNuevo: "PENDIENTE", datos: { conteo: "CALENDARIO_INCLUSIVO" }, actorId: actorId(actor) }, { transaction });
  return solicitud;
});

const asignacionesSolicitud = (solicitudId, transaction, lock = false) => VacacionSolicitudPeriodo.findAll({
  where: { solicitudId }, order: [["orden", "ASC"]], transaction,
  ...(lock && transaction ? { lock: transaction.LOCK.UPDATE } : {}),
});

const aprobarSolicitud = async (id, payload, actor) => sequelize.transaction(async (transaction) => {
  const solicitud = await VacacionSolicitud.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
  if (!solicitud) throw errorHttp(404, "SOLICITUD_NO_ENCONTRADA", "Solicitud no encontrada.");
  if (solicitud.estado !== "PENDIENTE") throw errorHttp(409, "ESTADO_NO_APROBABLE", "La solicitud ya fue procesada.");
  const asignaciones = await asignacionesSolicitud(id, transaction, true);
  const saldos = await obtenerSaldos(solicitud.usuarioId, transaction, true);
  const saldoPorId = new Map(saldos.map((item) => [Number(item.id), item]));
  for (const item of asignaciones) if (Number(item.dias) > Number(saldoPorId.get(Number(item.periodoId))?.disponibles || 0)) throw errorHttp(409, "SALDO_CAMBIO", "El saldo cambió; revise la solicitud antes de aprobar.");
  await crearMovimientos(asignaciones.map((item) => ({
    periodoId: item.periodoId, categoria: "COMPROMETIDO", dias: item.dias,
    motivo: `Reserva por solicitud #${id}`, fechaEfectiva: hoyGuayaquil(), origenTipo: "APROBACION_SOLICITUD", origenId: String(id), creadoPorId: actorId(actor),
  })), transaction);
  solicitud.estado = "APROBADA"; solicitud.aprobadorId = actorId(actor); solicitud.fechaAprobacion = new Date(); solicitud.fechaDecision = new Date(); solicitud.motivoDecision = payload?.motivo || null;
  await solicitud.save({ transaction });
  await VacacionHistorial.create({ solicitudId: id, accion: "APROBADA", estadoAnterior: "PENDIENTE", estadoNuevo: "APROBADA", motivo: payload?.motivo || null, actorId: actorId(actor) }, { transaction });
  return solicitud;
});

const rechazarSolicitud = async (id, payload, actor) => sequelize.transaction(async (transaction) => {
  const solicitud = await VacacionSolicitud.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
  if (!solicitud) throw errorHttp(404, "SOLICITUD_NO_ENCONTRADA", "Solicitud no encontrada.");
  if (solicitud.estado !== "PENDIENTE") throw errorHttp(409, "ESTADO_NO_RECHAZABLE", "Solo se rechazan solicitudes pendientes.");
  if (!String(payload?.motivo || "").trim()) throw errorHttp(400, "MOTIVO_REQUERIDO", "Indique el motivo del rechazo.");
  solicitud.estado = "RECHAZADA"; solicitud.aprobadorId = actorId(actor); solicitud.fechaDecision = new Date(); solicitud.motivoDecision = payload.motivo.trim();
  await solicitud.save({ transaction });
  await VacacionHistorial.create({ solicitudId: id, accion: "RECHAZADA", estadoAnterior: "PENDIENTE", estadoNuevo: "RECHAZADA", motivo: payload.motivo.trim(), actorId: actorId(actor) }, { transaction });
  return solicitud;
});

const totalConsumidoSolicitud = async (solicitudId, transaction) => {
  const movimientos = await VacacionMovimiento.findAll({ where: { origenTipo: "CONSUMO_SOLICITUD", origenId: { [Op.like]: `${solicitudId}:%` } }, transaction });
  return movimientos.filter((m) => Number(m.dias) > 0).reduce((sum, m) => sum + Number(m.dias), 0);
};

const procesarConsumo = async (id, actor, fechaHoy = hoyGuayaquil(), transactionExterna = null) => {
  const ejecutar = async (transaction) => {
    const solicitud = await VacacionSolicitud.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!solicitud || solicitud.estado !== "APROBADA" || fechaHoy < solicitud.fechaInicio) return solicitud;
    const objetivo = Math.min(Number(solicitud.cantidadDias), contarDiasCalendario(solicitud.fechaInicio, fechaHoy < solicitud.fechaFin ? fechaHoy : solicitud.fechaFin));
    let consumido = await totalConsumidoSolicitud(id, transaction);
    if (objetivo <= consumido) return solicitud;
    const asignaciones = await asignacionesSolicitud(id, transaction, true);
    const movimientos = [];
    for (const item of asignaciones) {
      if (consumido >= objetivo) break;
      const previosPeriodo = await VacacionMovimiento.sum("dias", { where: { periodoId: item.periodoId, categoria: "DISFRUTADO", origenTipo: "CONSUMO_SOLICITUD", origenId: { [Op.like]: `${id}:%` }, dias: { [Op.gt]: 0 } }, transaction }) || 0;
      const delta = Math.min(Number(item.dias) - Number(previosPeriodo), objetivo - consumido);
      if (delta <= 0) continue;
      const origenId = `${id}:${item.periodoId}:${decimal(Number(previosPeriodo) + delta)}`;
      movimientos.push(
        { periodoId: item.periodoId, categoria: "COMPROMETIDO", dias: -delta, motivo: `Conversión de reserva en disfrute solicitud #${id}`, fechaEfectiva: fechaHoy, origenTipo: "CONSUMO_SOLICITUD", origenId, creadoPorId: actorId(actor) },
        { periodoId: item.periodoId, categoria: "DISFRUTADO", dias: delta, motivo: `Días efectivamente disfrutados solicitud #${id}`, fechaEfectiva: fechaHoy, origenTipo: "CONSUMO_SOLICITUD", origenId, creadoPorId: actorId(actor) },
      );
      consumido += delta;
    }
    if (movimientos.length) await crearMovimientos(movimientos, transaction);
    return solicitud;
  };
  return transactionExterna ? ejecutar(transactionExterna) : sequelize.transaction(ejecutar);
};

const procesarConsumosPendientes = async (filtros, actor) => {
  const where = { estado: "APROBADA", fechaInicio: { [Op.lte]: hoyGuayaquil() } };
  if (filtros?.usuarioId) where.usuarioId = filtros.usuarioId;
  const solicitudes = await VacacionSolicitud.findAll({ where, attributes: ["id"], order: [["id", "ASC"]] });
  for (const solicitud of solicitudes) await procesarConsumo(solicitud.id, actor);
  return { procesadas: solicitudes.length, fechaCorte: hoyGuayaquil() };
};

const cancelarSolicitud = async (id, payload, actor) => sequelize.transaction(async (transaction) => {
  let solicitud = await VacacionSolicitud.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
  if (!solicitud) throw errorHttp(404, "SOLICITUD_NO_ENCONTRADA", "Solicitud no encontrada.");
  if (!["PENDIENTE", "APROBADA"].includes(solicitud.estado)) throw errorHttp(409, "ESTADO_NO_CANCELABLE", "La solicitud no puede cancelarse nuevamente.");
  if (!String(payload?.motivo || "").trim()) throw errorHttp(400, "MOTIVO_REQUERIDO", "Indique el motivo de cancelación.");
  if (solicitud.estado === "APROBADA") {
    await procesarConsumo(id, actor, hoyGuayaquil(), transaction);
    const consumido = await totalConsumidoSolicitud(id, transaction);
    let liberar = Number(solicitud.cantidadDias) - consumido;
    const asignaciones = await asignacionesSolicitud(id, transaction, true);
    const movimientos = [];
    for (const item of [...asignaciones].reverse()) {
      if (liberar <= 0) break;
      const cantidad = Math.min(Number(item.dias), liberar);
      movimientos.push({ periodoId: item.periodoId, categoria: "COMPROMETIDO", dias: -cantidad, motivo: `Liberación por cancelación solicitud #${id}`, fechaEfectiva: hoyGuayaquil(), origenTipo: "CANCELACION_SOLICITUD", origenId: String(id), creadoPorId: actorId(actor) });
      liberar -= cantidad;
    }
    if (movimientos.length) await crearMovimientos(movimientos, transaction);
  }
  const anterior = solicitud.estado; solicitud.estado = "CANCELADA"; solicitud.fechaDecision = new Date(); solicitud.motivoDecision = payload.motivo.trim();
  await solicitud.save({ transaction });
  await VacacionHistorial.create({ solicitudId: id, accion: "CANCELADA", estadoAnterior: anterior, estadoNuevo: "CANCELADA", motivo: payload.motivo.trim(), datos: { conservaDiasDisfrutados: true }, actorId: actorId(actor) }, { transaction });
  return solicitud;
});

const revisarSolicitud = async (id, payload, actor) => sequelize.transaction(async (transaction) => {
  const anterior = await VacacionSolicitud.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
  if (!anterior || !["PENDIENTE", "APROBADA"].includes(anterior.estado)) throw errorHttp(409, "SOLICITUD_NO_REVISABLE", "Solo se revisan solicitudes pendientes o aprobadas.");
  if (!String(payload?.motivoRevision || "").trim()) throw errorHttp(400, "MOTIVO_REQUERIDO", "Indique el motivo de la revisión.");
  if (anterior.estado === "APROBADA" && hoyGuayaquil() >= anterior.fechaInicio) {
    throw errorHttp(409, "VACACION_INICIADA", "Una vacación ya iniciada no se reescribe; cancélela para conservar lo disfrutado y registre otra solicitud.");
  }
  const estadoAnterior = anterior.estado;
  const asignacionesAnteriores = await asignacionesSolicitud(id, transaction, true);
  if (anterior.estado === "APROBADA") {
    await crearMovimientos(asignacionesAnteriores.map((item) => ({
      periodoId: item.periodoId, categoria: "COMPROMETIDO", dias: -Number(item.dias),
      motivo: `Liberación por revisión de solicitud #${id}`, fechaEfectiva: hoyGuayaquil(),
      origenTipo: "REVISION_SOLICITUD", origenId: String(id), creadoPorId: actorId(actor),
    })), transaction);
  }
  anterior.estado = "CANCELADA"; anterior.fechaDecision = new Date(); anterior.motivoDecision = `Revisada: ${payload.motivoRevision.trim()}`;
  await anterior.save({ transaction });

  const fechaInicio = payload.fechaInicio || anterior.fechaInicio;
  const fechaFin = payload.fechaFin || anterior.fechaFin;
  const fechaReincorporacion = payload.fechaReincorporacion || siguienteDia(fechaFin);
  const cantidadDias = contarDiasCalendario(fechaInicio, fechaFin);
  const usuario = await Usuario.findByPk(anterior.usuarioId, { transaction });
  if (fechaInicio < usuario.fechaIngreso || (usuario.fechaSalida && fechaFin > usuario.fechaSalida)) throw errorHttp(400, "FUERA_RELACION_LABORAL", "Las fechas quedan fuera de la relación laboral.");
  if (fechaReincorporacion <= fechaFin) throw errorHttp(400, "REINCORPORACION_INVALIDA", "La reincorporación debe ser posterior al último día incluido.");
  if (await buscarSuperposicion(anterior.usuarioId, fechaInicio, fechaFin, anterior.id, transaction)) throw errorHttp(409, "SOLICITUD_SUPERPUESTA", "La revisión se superpone con otra solicitud.");
  await validarColaboradorAgencia(anterior.usuarioId, payload.agenciaId || anterior.agenciaId, transaction);
  const saldos = await obtenerSaldos(anterior.usuarioId, transaction, true);
  validarAsignaciones({ asignaciones: payload.periodos, cantidadDias, periodos: saldos, motivoPrioridad: payload.motivoPrioridad });
  const map = new Map(saldos.map((saldo) => [Number(saldo.id), saldo]));
  for (const item of payload.periodos) if (Number(item.dias) > Number(map.get(Number(item.periodoId))?.disponibles || 0)) throw errorHttp(409, "SALDO_INSUFICIENTE", "La revisión excede el saldo disponible.");
  const nueva = await VacacionSolicitud.create({
    usuarioId: anterior.usuarioId, agenciaId: payload.agenciaId || anterior.agenciaId,
    cantidadDias, fechaInicio, fechaFin, fechaReincorporacion,
    observacion: payload.observacion ?? anterior.observacion,
    reemplazoUsuarioId: payload.reemplazoUsuarioId ?? anterior.reemplazoUsuarioId,
    estado: "PENDIENTE", motivoPrioridad: payload.motivoPrioridad || null,
    autorId: actorId(actor), idempotenciaKey: payload.idempotenciaKey || null,
    version: Number(anterior.version) + 1,
  }, { transaction });
  await VacacionSolicitudPeriodo.bulkCreate(payload.periodos.map((item, index) => ({ solicitudId: nueva.id, periodoId: item.periodoId, dias: item.dias, orden: index + 1 })), { transaction });
  await VacacionHistorial.bulkCreate([
    { solicitudId: anterior.id, accion: "REVISADA", estadoAnterior, estadoNuevo: "CANCELADA", motivo: payload.motivoRevision.trim(), datos: { nuevaSolicitudId: nueva.id }, actorId: actorId(actor) },
    { solicitudId: nueva.id, accion: "CREADA_POR_REVISION", estadoAnterior: null, estadoNuevo: "PENDIENTE", motivo: payload.motivoRevision.trim(), datos: { solicitudAnteriorId: anterior.id }, actorId: actorId(actor) },
  ], { transaction });
  return nueva;
});

const crearPago = async (payload, actor) => sequelize.transaction(async (transaction) => {
  if (!payload.usuarioId || !payload.concepto) throw errorHttp(400, "PAGO_INCOMPLETO", "Colaborador y concepto son obligatorios.");
  if (payload.idempotenciaKey) {
    const existente = await VacacionPago.findOne({ where: { idempotenciaKey: payload.idempotenciaKey }, transaction });
    if (existente) return existente;
  }
  const usuario = await Usuario.findByPk(payload.usuarioId, { transaction });
  if (!usuario) throw errorHttp(404, "USUARIO_NO_ENCONTRADO", "Colaborador no encontrado.");
  if (!String(payload.fundamento || "").trim()) throw errorHttp(400, "FUNDAMENTO_REQUERIDO", "Todo pago requiere fundamento legal y documental.");
  if (!Number.isFinite(Number(payload.monto)) || Number(payload.monto) < 0) throw errorHttp(400, "MONTO_INVALIDO", "Registre un monto válido sin inferir datos salariales.");
  if (payload.concepto === "LIQUIDACION_TERMINACION" && !usuario.fechaSalida) throw errorHttp(400, "TERMINACION_NO_REGISTRADA", "Registre la fecha de salida antes de liquidar pendientes.");
  if (payload.concepto === "COMPENSACION_ANTIGUEDAD" && !String(payload.fundamento || "").trim()) throw errorHttp(400, "FUNDAMENTO_REQUERIDO", "La compensación requiere fundamento legal/documental.");
  const consume = ["COMPENSACION_ANTIGUEDAD", "LIQUIDACION_TERMINACION"].includes(payload.concepto);
  if (consume && (!Array.isArray(payload.periodos) || !payload.periodos.length)) throw errorHttp(400, "PERIODOS_REQUERIDOS", "Seleccione los períodos que respaldan el pago.");
  const dias = decimal(payload.dias);
  const totalAsignado = (payload.periodos || []).reduce((sum, item) => sum + Number(item.dias), 0);
  if (consume && Math.abs(dias - totalAsignado) > 0.001) throw errorHttp(400, "DIAS_PAGO_INVALIDOS", "Los días del pago no coinciden con sus períodos.");
  const pago = await VacacionPago.create({
    usuarioId: usuario.id, concepto: payload.concepto, fundamento: payload.fundamento,
    dias, baseCalculo: payload.baseCalculo ?? null, monto: payload.monto,
    fechaPago: payload.fechaPago || null, medio: payload.medio || null, referencia: payload.referencia || null,
    soporte: payload.soporte || null, autorId: actorId(actor), idempotenciaKey: payload.idempotenciaKey || null,
  }, { transaction });
  if ((payload.periodos || []).length) await VacacionPagoPeriodo.bulkCreate(payload.periodos.map((item) => ({ pagoId: pago.id, periodoId: item.periodoId, dias: item.dias })), { transaction });
  return pago;
});

const aprobarPago = async (id, actor) => sequelize.transaction(async (transaction) => {
  const pago = await VacacionPago.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
  if (!pago || pago.estado !== "PENDIENTE_PAGO" || pago.fechaAprobacion) throw errorHttp(409, "PAGO_NO_APROBABLE", "El pago no existe o ya fue aprobado.");
  const consume = ["COMPENSACION_ANTIGUEDAD", "LIQUIDACION_TERMINACION"].includes(pago.concepto);
  if (consume) {
    const asignaciones = await VacacionPagoPeriodo.findAll({ where: { pagoId: id }, transaction, lock: transaction.LOCK.UPDATE });
    const saldos = await obtenerSaldos(pago.usuarioId, transaction, true); const map = new Map(saldos.map((s) => [Number(s.id), s]));
    for (const item of asignaciones) {
      const saldo = map.get(Number(item.periodoId));
      const disponible = pago.concepto === "COMPENSACION_ANTIGUEDAD" ? saldo?.adicionalesDisponibles : saldo?.disponibles;
      if (Number(item.dias) > Number(disponible || 0)) throw errorHttp(409, "SALDO_PAGO_INSUFICIENTE", "No hay saldo legalmente compensable suficiente.");
    }
    await crearMovimientos(asignaciones.map((item) => ({ periodoId: item.periodoId, categoria: "RESERVADO_COMPENSACION", dias: item.dias, motivo: `Reserva para pago #${id}`, fechaEfectiva: hoyGuayaquil(), origenTipo: "APROBACION_PAGO", origenId: String(id), creadoPorId: actorId(actor) })), transaction);
  }
  pago.aprobadorId = actorId(actor); pago.fechaAprobacion = new Date(); await pago.save({ transaction }); return pago;
});

const confirmarPago = async (id, payload, actor) => sequelize.transaction(async (transaction) => {
  const pago = await VacacionPago.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
  if (!pago || pago.estado !== "PENDIENTE_PAGO" || !pago.fechaAprobacion) throw errorHttp(409, "PAGO_NO_CONFIRMABLE", "El pago debe estar aprobado y pendiente.");
  const consume = ["COMPENSACION_ANTIGUEDAD", "LIQUIDACION_TERMINACION"].includes(pago.concepto);
  if (consume) {
    const asignaciones = await VacacionPagoPeriodo.findAll({ where: { pagoId: id }, transaction, lock: transaction.LOCK.UPDATE });
    await crearMovimientos(asignaciones.flatMap((item) => [
      { periodoId: item.periodoId, categoria: "RESERVADO_COMPENSACION", dias: -Number(item.dias), motivo: `Confirmación pago #${id}`, fechaEfectiva: payload.fechaPago || hoyGuayaquil(), origenTipo: "CONFIRMACION_PAGO", origenId: String(id), creadoPorId: actorId(actor) },
      { periodoId: item.periodoId, categoria: "COMPENSADO", dias: item.dias, motivo: `Días compensados pago #${id}`, fechaEfectiva: payload.fechaPago || hoyGuayaquil(), origenTipo: "CONFIRMACION_PAGO", origenId: String(id), creadoPorId: actorId(actor) },
    ]), transaction);
  }
  pago.estado = "PAGADO"; pago.pagadorId = actorId(actor); pago.fechaPago = payload.fechaPago || hoyGuayaquil(); pago.medio = payload.medio || pago.medio; pago.referencia = payload.referencia || pago.referencia; await pago.save({ transaction }); return pago;
});

const anularPago = async (id, payload, actor) => sequelize.transaction(async (transaction) => {
  const pago = await VacacionPago.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
  if (!pago || pago.estado === "ANULADO") throw errorHttp(409, "PAGO_NO_ANULABLE", "El pago no existe o ya fue anulado.");
  if (!String(payload?.motivo || "").trim()) throw errorHttp(400, "MOTIVO_REQUERIDO", "Indique el motivo de anulación.");
  const asignaciones = await VacacionPagoPeriodo.findAll({ where: { pagoId: id }, transaction, lock: transaction.LOCK.UPDATE });
  const categoria = pago.estado === "PAGADO" ? "COMPENSADO" : (pago.fechaAprobacion ? "RESERVADO_COMPENSACION" : null);
  if (categoria) await crearMovimientos(asignaciones.map((item) => ({ periodoId: item.periodoId, categoria, dias: -Number(item.dias), motivo: `Reversión pago #${id}: ${payload.motivo}`, fechaEfectiva: hoyGuayaquil(), origenTipo: "ANULACION_PAGO", origenId: String(id), creadoPorId: actorId(actor) })), transaction);
  pago.estado = "ANULADO"; pago.soporte = [pago.soporte, `ANULADO: ${payload.motivo}`].filter(Boolean).join("\n"); await pago.save({ transaction }); return pago;
});

module.exports = {
  aprobarPago, aprobarSolicitud, anularPago, buscarSuperposicion, cancelarSolicitud,
  confirmarPago, crearAjuste, crearPago, crearPeriodo, crearSolicitud,
  obtenerSaldos, procesarConsumo, procesarConsumosPendientes,
  rechazarSolicitud, revisarSolicitud,
};
