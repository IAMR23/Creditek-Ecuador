const { cambiarResponsable } = require("../../services/entregaOperacionService");

const esAdministrador = (req) =>
  (req.user?.permisos || []).some(
    (permiso) => String(permiso).trim().toLowerCase() === "administracion",
  );

const asignarEntrega = async (req, res) => {
  try {
    const { entregaId } = req.params;
    const {
      usuarioAgenciaId,
      forzarReasignacion,
      expectedVersion,
      motivo,
      iniciarTransito,
      fechaHoraAsignacion,
      horaEstimadaEntrega,
      sectorEntrega,
      tipoEntrega,
      idempotencyKey,
    } = req.body;

    const resultado = await cambiarResponsable({
      entregaId,
      usuarioAgenciaId,
      forzarReasignacion: Boolean(forzarReasignacion),
      expectedVersion,
      actorUsuarioId: req.user.id,
      motivo,
      iniciarTransito: Boolean(iniciarTransito),
      datosOperacion: {
        fechaHoraAsignacion,
        horaEstimadaEntrega,
        sectorEntrega,
        tipoEntrega,
      },
      idempotencyKey: idempotencyKey || req.get("Idempotency-Key") || null,
      scopeAgenciaId: esAdministrador(req) ? null : req.user.agenciaId,
    });

    return res.status(200).json({
      message: resultado.idempotente
        ? "La operacion ya habia sido aplicada"
        : "Responsable actualizado correctamente",
      entrega: resultado.entrega,
      asignacion: resultado.asignacion,
      idempotente: resultado.idempotente,
    });
  } catch (error) {
    const status = error.statusCode || 500;
    if (status >= 500) console.error("Error asignando entrega:", error);
    return res.status(status).json({
      code: error.code || "ERROR_ASIGNANDO_ENTREGA",
      message: error.message || "Error al asignar la entrega",
      ...(error.details || {}),
    });
  }
};

module.exports = { asignarEntrega };
