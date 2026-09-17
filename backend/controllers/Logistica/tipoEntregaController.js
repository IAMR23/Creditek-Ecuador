const Entrega = require("../../models/Entrega");
const EntregaEvento = require("../../models/EntregaEvento");
const { sequelize } = require("../../config/db");
const {
  validarEntregaEnAgencia,
  validarVersion,
} = require("../../services/entregaOperacionService");

const TIPOS_ENTREGA = Object.freeze(["Entrega", "Envio"]);

const actualizarTipoEntrega = async (req, res) => {
  const { id } = req.params;
  const { tipoEntrega, expectedVersion } = req.body;
  const idempotencyKey =
    req.body.idempotencyKey || req.get("Idempotency-Key") || null;

  if (!TIPOS_ENTREGA.includes(tipoEntrega)) {
    return res.status(400).json({
      ok: false,
      message: "El tipo debe ser Entrega o Envío.",
    });
  }

  const transaction = await sequelize.transaction();
  try {
    if (idempotencyKey) {
      const eventoPrevio = await EntregaEvento.findOne({
        where: { idempotencyKey },
        transaction,
      });
      if (eventoPrevio) {
        if (
          eventoPrevio.tipo !== "TIPO_ENTREGA_CAMBIADO" ||
          Number(eventoPrevio.entregaId) !== Number(id)
        ) {
          const error = new Error("La clave de idempotencia ya fue utilizada por otra operación.");
          error.statusCode = 409;
          error.code = "IDEMPOTENCY_KEY_REUTILIZADA";
          throw error;
        }
        const entregaActual = await Entrega.findByPk(id, { transaction });
        await transaction.commit();
        return res.json({ ok: true, idempotente: true, version: entregaActual.version, entrega: entregaActual });
      }
    }
    const entrega = await Entrega.findByPk(id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!entrega) {
      await transaction.rollback();
      return res.status(404).json({
        ok: false,
        message: "Entrega no encontrada.",
      });
    }

    const esAdministrador = (req.user?.permisos || []).some(
      (permiso) => String(permiso).trim().toLowerCase() === "administracion",
    );
    await validarEntregaEnAgencia({
      entrega,
      scopeAgenciaId: esAdministrador ? null : req.user.agenciaId,
      transaction,
    });

    validarVersion(entrega, expectedVersion);
    const tipoAnterior = entrega.tipoEntrega;
    await entrega.update(
      { tipoEntrega, version: Number(entrega.version) + 1 },
      { transaction },
    );
    await EntregaEvento.create(
      {
        entregaId: entrega.id,
        tipo: "TIPO_ENTREGA_CAMBIADO",
        estadoAnterior: entrega.estado,
        estadoNuevo: entrega.estado,
        actorUsuarioId: req.user.id,
        motivo: "Cambio de tipo de gestion logistica",
        idempotencyKey,
        metadata: { tipoAnterior, tipoNuevo: tipoEntrega },
      },
      { transaction },
    );
    await transaction.commit();

    return res.json({
      ok: true,
      message: "Tipo de entrega actualizado.",
      entrega: {
        id: entrega.id,
        tipoEntrega: entrega.tipoEntrega,
        version: entrega.version,
      },
      version: entrega.version,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error actualizando el tipo de entrega:", error);
    return res.status(error.statusCode || 500).json({
      ok: false,
      code: error.code || "ERROR_TIPO_ENTREGA",
      message: error.message || "Error al actualizar el tipo de entrega.",
    });
  }
};

module.exports = {
  TIPOS_ENTREGA,
  actualizarTipoEntrega,
};
