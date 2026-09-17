const { Op, UniqueConstraintError } = require("sequelize");
const { sequelize } = require("../config/db");
const Entrega = require("../models/Entrega");
const EntregaEvento = require("../models/EntregaEvento");
const UsuarioAgencia = require("../models/UsuarioAgencia");
const UsuarioAgenciaEntrega = require("../models/UsuarioAgenciaEntrega");
const Usuario = require("../models/Usuario");
const Rol = require("../models/Rol");

const ESTADOS_FINALES = Object.freeze(["Entregado", "No Entregado"]);
const TRANSICIONES = Object.freeze({
  Pendiente: ["Transito", "Revisar"],
  Revisar: ["Pendiente", "Transito"],
  Transito: ["Entregado", "No Entregado", "Revisar"],
});

const crearError = (statusCode, code, message, details) =>
  Object.assign(new Error(message), { statusCode, code, details });

const normalizarVersion = (value) => {
  const version = Number(value);
  if (!Number.isInteger(version) || version < 0) {
    throw crearError(
      400,
      "VERSION_REQUERIDA",
      "Debe enviar una version esperada valida.",
    );
  }
  return version;
};

const validarVersion = (entrega, expectedVersion) => {
  const version = normalizarVersion(expectedVersion);
  if (Number(entrega.version) !== version) {
    throw crearError(
      409,
      "ENTREGA_DESACTUALIZADA",
      "La entrega cambio desde que fue consultada. Recargue los datos.",
      { entregaId: entrega.id, versionActual: Number(entrega.version) },
    );
  }
};

const obtenerEventoIdempotente = async ({
  entregaId,
  tipo,
  idempotencyKey,
  transaction,
}) => {
  if (!idempotencyKey) return null;
  const evento = await EntregaEvento.findOne({
    where: { idempotencyKey },
    transaction,
  });
  if (!evento) return null;
  if (Number(evento.entregaId) !== Number(entregaId) || evento.tipo !== tipo) {
    throw crearError(
      409,
      "IDEMPOTENCY_KEY_REUTILIZADA",
      "La clave de idempotencia ya fue utilizada por otra operacion.",
    );
  }
  return evento;
};

const crearEvento = (values, transaction) =>
  EntregaEvento.create(values, { transaction });

const rolesDeUsuario = (usuario = {}) => [
  usuario.rol,
  ...(Array.isArray(usuario.roles) ? usuario.roles : []),
].filter(Boolean);

const validarResponsableDestino = async ({
  usuarioAgenciaId,
  scopeAgenciaId,
  transaction,
}) => {
  const destino = await UsuarioAgencia.findOne({
    where: {
      id: usuarioAgenciaId,
      activo: true,
      ...(scopeAgenciaId ? { agenciaId: scopeAgenciaId } : {}),
    },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  const usuario = destino
    ? await Usuario.findOne({
        where: { id: destino.usuarioId, activo: true },
        include: [
          { model: Rol, as: "rol", required: false },
          {
            model: Rol,
            as: "roles",
            required: false,
            through: { attributes: [] },
          },
        ],
        transaction,
      })
    : null;

  const esRepartidor = rolesDeUsuario(usuario).some(
    (rol) => String(rol.nombre || "").trim().toLowerCase() === "repartidor",
  );
  if (!destino || !esRepartidor) {
    throw crearError(
      400,
      "RESPONSABLE_DESTINO_INVALIDO",
      "El responsable destino no esta activo, autorizado o dentro de la agencia permitida.",
    );
  }
  return destino;
};

const obtenerEntregaBloqueada = async (entregaId, transaction) => {
  const entrega = await Entrega.findByPk(entregaId, {
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  if (!entrega) {
    throw crearError(404, "ENTREGA_NO_ENCONTRADA", "Entrega no encontrada.");
  }
  return entrega;
};

const validarEntregaEnAgencia = async ({ entrega, scopeAgenciaId, transaction }) => {
  if (!scopeAgenciaId) return;
  const relacionVendedora = await UsuarioAgencia.findOne({
    where: { id: entrega.usuarioAgenciaId, agenciaId: scopeAgenciaId },
    attributes: ["id"],
    transaction,
  });
  if (!relacionVendedora) {
    throw crearError(
      403,
      "ENTREGA_FUERA_DE_AGENCIA",
      "La entrega no pertenece a la agencia autorizada.",
    );
  }
};

const obtenerAsignacionActiva = (entregaId, transaction) =>
  UsuarioAgenciaEntrega.findOne({
    where: { entrega_id: entregaId, activo: true },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });

const cambiarResponsableEnTransaccion = async ({
  entregaId,
  usuarioAgenciaId,
  expectedVersion,
  actorUsuarioId,
  motivo,
  idempotencyKey,
  iniciarTransito = false,
  datosOperacion = {},
  scopeAgenciaId,
  forzarReasignacion = false,
  transaction,
}) => {
  if (!String(motivo || "").trim()) {
    throw crearError(400, "MOTIVO_REQUERIDO", "El motivo es obligatorio.");
  }

  const entrega = await obtenerEntregaBloqueada(entregaId, transaction);
  await validarEntregaEnAgencia({ entrega, scopeAgenciaId, transaction });
  const eventoPrevio = await obtenerEventoIdempotente({
    entregaId,
    tipo: "RESPONSABLE_CAMBIADO",
    idempotencyKey,
    transaction,
  });
  if (eventoPrevio) {
    return {
      entrega,
      asignacion: await obtenerAsignacionActiva(entregaId, transaction),
      idempotente: true,
    };
  }

  validarVersion(entrega, expectedVersion);
  if (ESTADOS_FINALES.includes(entrega.estado)) {
    throw crearError(
      409,
      "ENTREGA_FINALIZADA",
      "Una entrega finalizada no puede cambiar de responsable.",
    );
  }

  await validarResponsableDestino({
    usuarioAgenciaId,
    scopeAgenciaId,
    transaction,
  });

  const asignacionAnterior = await obtenerAsignacionActiva(entregaId, transaction);
  const mismoResponsable =
    asignacionAnterior &&
    Number(asignacionAnterior.usuario_agencia_id) === Number(usuarioAgenciaId);
  const hayDatosOperacion = Object.values(datosOperacion || {}).some(
    (value) => value !== undefined,
  );
  if (mismoResponsable && !iniciarTransito && !hayDatosOperacion) {
    return { entrega, asignacion: asignacionAnterior, idempotente: true };
  }
  if (asignacionAnterior && !mismoResponsable && !forzarReasignacion) {
    throw crearError(
      409,
      "REASIGNACION_REQUIERE_CONFIRMACION",
      "La entrega ya tiene responsable. Confirme la reasignacion.",
      { requiereConfirmacion: true },
    );
  }

  const ahora = new Date();
  if (asignacionAnterior && !mismoResponsable) {
    await asignacionAnterior.update(
      {
        activo: false,
        estado: "Reasignada",
        fecha_desasignacion: ahora,
      },
      { transaction },
    );
  }

  let asignacionNueva = asignacionAnterior;
  if (!mismoResponsable) {
    try {
      asignacionNueva = await UsuarioAgenciaEntrega.create(
        {
          usuario_agencia_id: usuarioAgenciaId,
          entrega_id: entregaId,
          estado: "Asignada",
          activo: true,
          fecha_asignacion: ahora,
          fecha_desasignacion: null,
          fecha_finalizacion: null,
        },
        { transaction },
      );
    } catch (error) {
      if (error instanceof UniqueConstraintError || error?.name === "SequelizeUniqueConstraintError") {
        throw crearError(
          409,
          "ASIGNACION_CONCURRENTE",
          "Otra operacion asigno un responsable. Recargue los datos.",
        );
      }
      throw error;
    }
  }

  const estadoAnterior = entrega.estado;
  const estadoNuevo = iniciarTransito ? "Transito" : entrega.estado;
  if (iniciarTransito && !["Pendiente", "Revisar", "Transito"].includes(entrega.estado)) {
    throw crearError(
      409,
      "TRANSICION_INVALIDA",
      `No se puede enviar una entrega ${entrega.estado} a Transito.`,
    );
  }

  const camposOperacion = [
    "fechaHoraAsignacion",
    "horaEstimadaEntrega",
    "sectorEntrega",
    "tipoEntrega",
  ].reduce((acc, campo) => {
    if (datosOperacion[campo] !== undefined) acc[campo] = datosOperacion[campo];
    return acc;
  }, {});

  await entrega.update(
    {
      ...camposOperacion,
      estado: estadoNuevo,
      version: Number(entrega.version) + 1,
    },
    { transaction },
  );

  await crearEvento(
    {
      entregaId: entrega.id,
      tipo: "RESPONSABLE_CAMBIADO",
      estadoAnterior,
      estadoNuevo,
      usuarioAgenciaAnteriorId: asignacionAnterior?.usuario_agencia_id || null,
      usuarioAgenciaNuevoId: Number(usuarioAgenciaId),
      actorUsuarioId,
      motivo: String(motivo).trim(),
      idempotencyKey: idempotencyKey || null,
      metadata: {
        iniciarTransito,
        mismoResponsable,
        camposOperacion: Object.keys(camposOperacion),
      },
    },
    transaction,
  );

  return { entrega, asignacion: asignacionNueva, idempotente: false };
};

const cambiarResponsable = async (params) => {
  const transaction = await sequelize.transaction();
  try {
    const resultado = await cambiarResponsableEnTransaccion({
      ...params,
      transaction,
    });
    await transaction.commit();
    return resultado;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

const actualizarEstadoEnTransaccion = async ({
  entregaId,
  nuevoEstado,
  expectedVersion,
  actorUsuarioId,
  motivo,
  observacionEntrega,
  observacionLogistica,
  idempotencyKey,
  responsableRequeridoId,
  scopeAgenciaId,
  transaction,
}) => {
  if (!String(motivo || "").trim()) {
    throw crearError(400, "MOTIVO_REQUERIDO", "El motivo es obligatorio.");
  }
  const entrega = await obtenerEntregaBloqueada(entregaId, transaction);
  await validarEntregaEnAgencia({ entrega, scopeAgenciaId, transaction });
  const eventoPrevio = await obtenerEventoIdempotente({
    entregaId,
    tipo: "ESTADO_CAMBIADO",
    idempotencyKey,
    transaction,
  });
  if (eventoPrevio) {
    return { entrega, idempotente: true };
  }

  validarVersion(entrega, expectedVersion);
  if (entrega.estado === nuevoEstado) return { entrega, idempotente: true };
  if (!(TRANSICIONES[entrega.estado] || []).includes(nuevoEstado)) {
    throw crearError(
      409,
      "TRANSICION_INVALIDA",
      `No se permite cambiar de ${entrega.estado} a ${nuevoEstado}.`,
    );
  }

  const asignacion = await obtenerAsignacionActiva(entregaId, transaction);
  if (
    responsableRequeridoId &&
    Number(asignacion?.usuario_agencia_id) !== Number(responsableRequeridoId)
  ) {
    throw crearError(
      403,
      "ENTREGA_NO_AUTORIZADA",
      "La entrega no pertenece al responsable autenticado.",
    );
  }
  if (nuevoEstado === "Transito" && !asignacion) {
    throw crearError(
      409,
      "RESPONSABLE_REQUERIDO",
      "La entrega necesita un responsable vigente antes de pasar a Transito.",
    );
  }

  const estadoAnterior = entrega.estado;
  await entrega.update(
    {
      estado: nuevoEstado,
      ...(observacionEntrega !== undefined ? { observacionEntrega } : {}),
      ...(observacionLogistica !== undefined ? { observacionLogistica } : {}),
      version: Number(entrega.version) + 1,
    },
    { transaction },
  );

  if (asignacion && ESTADOS_FINALES.includes(nuevoEstado)) {
    await asignacion.update(
      { estado: "Finalizada", fecha_finalizacion: new Date() },
      { transaction },
    );
  }

  await crearEvento(
    {
      entregaId: entrega.id,
      tipo: "ESTADO_CAMBIADO",
      estadoAnterior,
      estadoNuevo: nuevoEstado,
      usuarioAgenciaAnteriorId: asignacion?.usuario_agencia_id || null,
      usuarioAgenciaNuevoId: asignacion?.usuario_agencia_id || null,
      actorUsuarioId,
      motivo: String(motivo).trim(),
      idempotencyKey: idempotencyKey || null,
      metadata: {},
    },
    transaction,
  );
  return { entrega, idempotente: false };
};

const actualizarEstado = async (params) => {
  const transaction = await sequelize.transaction();
  try {
    const resultado = await actualizarEstadoEnTransaccion({ ...params, transaction });
    await transaction.commit();
    return resultado;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

const desactivarUsuarioAgencia = async ({
  usuarioAgenciaId,
  responsableDestinoId,
  actorUsuarioId,
  motivo,
  idempotencyKey,
  scopeAgenciaId,
}) => {
  const transaction = await sequelize.transaction();
  try {
    const relacion = await UsuarioAgencia.findByPk(usuarioAgenciaId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!relacion) {
      throw crearError(404, "RELACION_NO_ENCONTRADA", "Relacion no encontrada.");
    }
    if (!relacion.activo) {
      await transaction.commit();
      return { relacion, entregasTrasladadas: [], idempotente: true };
    }

    const asignaciones = await UsuarioAgenciaEntrega.findAll({
      where: { usuario_agencia_id: usuarioAgenciaId, activo: true },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    const entregas = asignaciones.length
      ? await Entrega.findAll({
          where: {
            id: { [Op.in]: asignaciones.map((item) => item.entrega_id) },
            activo: true,
            estado: { [Op.notIn]: ESTADOS_FINALES },
          },
          transaction,
          lock: transaction.LOCK.UPDATE,
        })
      : [];

    if (entregas.length && !responsableDestinoId) {
      throw crearError(
        409,
        "ENTREGAS_ABIERTAS_REQUIEREN_REASIGNACION",
        "La relacion tiene entregas abiertas. Seleccione un responsable destino.",
        { entregaIds: entregas.map((item) => item.id), total: entregas.length },
      );
    }
    if (Number(responsableDestinoId) === Number(usuarioAgenciaId)) {
      throw crearError(400, "DESTINO_IGUAL_ORIGEN", "El responsable destino debe ser diferente.");
    }

    const trasladadas = [];
    for (const entrega of entregas) {
      const resultado = await cambiarResponsableEnTransaccion({
        entregaId: entrega.id,
        usuarioAgenciaId: responsableDestinoId,
        expectedVersion: entrega.version,
        actorUsuarioId,
        motivo,
        idempotencyKey: idempotencyKey ? `${idempotencyKey}:${entrega.id}` : null,
        iniciarTransito: false,
        scopeAgenciaId,
        forzarReasignacion: true,
        transaction,
      });
      trasladadas.push({ entregaId: entrega.id, version: resultado.entrega.version });
    }

    await relacion.update({ activo: false }, { transaction });
    await transaction.commit();
    return { relacion, entregasTrasladadas: trasladadas, idempotente: false };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

module.exports = {
  ESTADOS_FINALES,
  TRANSICIONES,
  actualizarEstado,
  actualizarEstadoEnTransaccion,
  cambiarResponsable,
  cambiarResponsableEnTransaccion,
  crearError,
  desactivarUsuarioAgencia,
  normalizarVersion,
  validarVersion,
  validarEntregaEnAgencia,
};
