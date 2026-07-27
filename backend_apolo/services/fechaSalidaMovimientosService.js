const { Op } = require("sequelize");

const Asistencia = require("../models/Asistencia");
const UsuarioAgencia = require("../models/UsuarioAgencia");

const normalizarFechaSalida = (fecha) => fecha || null;

const sincronizarFechaSalidaEnMovimientos = async ({
  usuarioId,
  fechaAnterior,
  fechaNueva,
  usuarioAgenciaIdPreferido = null,
  transaction = null,
}) => {
  const anterior = normalizarFechaSalida(fechaAnterior);
  const nueva = normalizarFechaSalida(fechaNueva);
  const relaciones = await UsuarioAgencia.findAll({
    where: { usuarioId },
    attributes: ["id", "activo", "updatedAt"],
    order: [
      ["activo", "DESC"],
      ["updatedAt", "DESC"],
      ["id", "DESC"],
    ],
    transaction,
  });
  const relacionIds = relaciones.map((relacion) => relacion.id);

  if (anterior && anterior !== nueva && relacionIds.length) {
    await Asistencia.update(
      { estado: null },
      {
        where: {
          usuarioAgenciaId: { [Op.in]: relacionIds },
          fecha: anterior,
          estado: "salida",
        },
        transaction,
      },
    );
  }

  if (!nueva) {
    return {
      sincronizado: true,
      movimientoCreado: false,
      fechaSalida: null,
    };
  }

  const existente = relacionIds.length
    ? await Asistencia.findOne({
        where: {
          usuarioAgenciaId: { [Op.in]: relacionIds },
          fecha: nueva,
        },
        order: [
          ["updatedAt", "DESC"],
          ["id", "DESC"],
        ],
        transaction,
      })
    : null;
  const relacionPreferida = relaciones.find(
    (relacion) =>
      String(relacion.id) === String(usuarioAgenciaIdPreferido),
  );
  const relacionActiva = relaciones.find((relacion) => relacion.activo);
  const usuarioAgenciaId =
    existente?.usuarioAgenciaId ||
    relacionPreferida?.id ||
    relacionActiva?.id ||
    null;

  if (!usuarioAgenciaId) {
    console.warn(
      `No se pudo reflejar fechaSalida en Movimientos de Terminales: el usuario ABS ${usuarioId} no tiene relación con una agencia.`,
    );
    return {
      sincronizado: false,
      movimientoCreado: false,
      fechaSalida: nueva,
      motivo: "USUARIO_SIN_AGENCIA",
    };
  }

  await Asistencia.upsert(
    {
      usuarioAgenciaId,
      fecha: nueva,
      estado: "salida",
      ...(existente
        ? { observacion: existente.observacion || null }
        : {}),
    },
    { transaction },
  );

  return {
    sincronizado: true,
    movimientoCreado: true,
    fechaSalida: nueva,
    usuarioAgenciaId,
  };
};

module.exports = {
  normalizarFechaSalida,
  sincronizarFechaSalidaEnMovimientos,
};
