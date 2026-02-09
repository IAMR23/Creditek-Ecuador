const { sequelize } = require("../../config/db");
const Entrega = require("../../models/Entrega");
const UsuarioAgencia = require("../../models/UsuarioAgencia");
const UsuarioAgenciaEntrega = require("../../models/UsuarioAgenciaEntrega");


const asignarEntrega = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { entregaId } = req.params;
    const { usuarioAgenciaId, forzarReasignacion } = req.body;

    const entrega = await Entrega.findByPk(entregaId, { transaction: t, lock: true });
    if (!entrega) {
      await t.rollback();
      return res.status(404).json({ message: "Entrega no encontrada" });
    }   

    const usuarioAgencia = await UsuarioAgencia.findOne({
      where: { id: usuarioAgenciaId, activo: true },
      transaction: t,
    });

    if (!usuarioAgencia) {
      await t.rollback();
      return res.status(404).json({
        message: "Usuario agencia no válido o inactivo",
      });
    }

    const asignacionExistente = await UsuarioAgenciaEntrega.findOne({
      where: {
        entrega_id: entregaId,
        activo: true,
      },
      transaction: t,
      lock: true,
    });

    if (asignacionExistente && !forzarReasignacion) {
      await t.rollback();
      return res.status(409).json({
        message: "La entrega ya está asignada",
        requiereConfirmacion: true,
      });
    }

    if (asignacionExistente && forzarReasignacion) {
      await asignacionExistente.update(
        {
          activo: false,
          fecha_desasignacion: new Date(),
          estado: "Reasignada",
        },
        { transaction: t }
      );
    }

    const nuevaAsignacion = await UsuarioAgenciaEntrega.create(
      {
        usuario_agencia_id: usuarioAgenciaId,
        entrega_id: entregaId,
        estado: "Asignada",
        activo: true,
        fecha_asignacion: new Date(),
      },
      { transaction: t }
    );

    await t.commit();

    res.status(201).json({
      message: "Entrega asignada correctamente",
      nuevaAsignacion,
    });
  } catch (error) {
    await t.rollback();
    console.error("❌ Error asignando entrega:", error);
    res.status(500).json({
      message: "Error al asignar la entrega",
    });
  }
};


module.exports = {
  asignarEntrega,
};
