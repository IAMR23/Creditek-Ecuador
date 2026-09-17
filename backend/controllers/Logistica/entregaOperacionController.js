const { sequelize } = require("../../config/db");
const Entrega = require("../../models/Entrega");
const EntregaEvento = require("../../models/EntregaEvento");
const {
  actualizarEstado,
  crearError,
  validarVersion,
  validarEntregaEnAgencia,
} = require("../../services/entregaOperacionService");

const esAdministrador = (req) =>
  (req.user?.permisos || []).some(
    (permiso) => String(permiso).trim().toLowerCase() === "administracion",
  );

const CAMPOS_EDICION_GENERICA = Object.freeze([
  "errores",
  "observacionLogistica",
  "observacionEntrega",
  "fechaHoraAsignacion",
  "horaEstimadaEntrega",
  "sectorEntrega",
]);

const responderError = (res, error, fallback) => {
  const status = error.statusCode || 500;
  if (status >= 500) console.error(fallback, error);
  return res.status(status).json({
    code: error.code || "ENTREGA_OPERACION_ERROR",
    message: error.message || fallback,
    ...(error.details || {}),
  });
};

const cambiarEstado = async (req, res) => {
  try {
    const resultado = await actualizarEstado({
      entregaId: req.params.id,
      nuevoEstado: req.body.estado,
      expectedVersion: req.body.expectedVersion,
      actorUsuarioId: req.user.id,
      motivo: req.body.motivo,
      observacionEntrega: req.body.observacionEntrega,
      observacionLogistica: req.body.observacionLogistica,
      idempotencyKey:
        req.body.idempotencyKey || req.get("Idempotency-Key") || null,
      responsableRequeridoId:
        String(req.user.rol || "").trim().toLowerCase() === "repartidor"
          ? req.user.usuarioAgenciaId
          : null,
      scopeAgenciaId: esAdministrador(req) ? null : req.user.agenciaId,
    });
    return res.json({ ok: true, ...resultado, version: resultado.entrega.version });
  } catch (error) {
    return responderError(res, error, "No se pudo actualizar el estado.");
  }
};

const actualizarCamposGenerales = async (req, res) => {
  const camposNoPermitidos = Object.keys(req.body || {}).filter(
    (campo) =>
      !CAMPOS_EDICION_GENERICA.includes(campo) &&
      campo !== "expectedVersion" &&
      campo !== "motivo" &&
      campo !== "idempotencyKey",
  );
  if (camposNoPermitidos.length) {
    return res.status(400).json({
      code: "CAMPOS_NO_PERMITIDOS",
      message: "La edicion general contiene campos no permitidos.",
      campos: camposNoPermitidos,
    });
  }

  const transaction = await sequelize.transaction();
  try {
    const idempotencyKey =
      req.body.idempotencyKey || req.get("Idempotency-Key") || null;
    if (idempotencyKey) {
      const eventoPrevio = await EntregaEvento.findOne({
        where: { idempotencyKey },
        transaction,
      });
      if (eventoPrevio) {
        if (
          eventoPrevio.tipo !== "DATOS_ACTUALIZADOS" ||
          Number(eventoPrevio.entregaId) !== Number(req.params.id)
        ) {
          throw crearError(
            409,
            "IDEMPOTENCY_KEY_REUTILIZADA",
            "La clave de idempotencia ya fue utilizada por otra operacion.",
          );
        }
        const entregaActual = await Entrega.findByPk(req.params.id, { transaction });
        await transaction.commit();
        return res.json({ ...entregaActual.toJSON(), idempotente: true });
      }
    }
    const entrega = await Entrega.findByPk(req.params.id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!entrega) {
      throw crearError(404, "ENTREGA_NO_ENCONTRADA", "Entrega no encontrada.");
    }
    await validarEntregaEnAgencia({
      entrega,
      scopeAgenciaId: esAdministrador(req) ? null : req.user.agenciaId,
      transaction,
    });
    validarVersion(entrega, req.body.expectedVersion);

    const cambios = CAMPOS_EDICION_GENERICA.reduce((acc, campo) => {
      if (req.body[campo] !== undefined) acc[campo] = req.body[campo];
      return acc;
    }, {});
    if (!Object.keys(cambios).length) {
      throw crearError(400, "SIN_CAMBIOS", "No se enviaron campos editables.");
    }
    const versionAnterior = Number(entrega.version);
    await entrega.update(
      { ...cambios, version: versionAnterior + 1 },
      { transaction },
    );
    await EntregaEvento.create(
      {
        entregaId: entrega.id,
        tipo: "DATOS_ACTUALIZADOS",
        estadoAnterior: entrega.estado,
        estadoNuevo: entrega.estado,
        actorUsuarioId: req.user.id,
        motivo: String(req.body.motivo || "Actualizacion de datos operativos").trim(),
        idempotencyKey,
        metadata: { campos: Object.keys(cambios), versionAnterior },
      },
      { transaction },
    );
    await transaction.commit();
    return res.json(entrega);
  } catch (error) {
    await transaction.rollback();
    return responderError(res, error, "No se pudo actualizar la entrega.");
  }
};

module.exports = {
  CAMPOS_EDICION_GENERICA,
  actualizarCamposGenerales,
  cambiarEstado,
  responderError,
};
