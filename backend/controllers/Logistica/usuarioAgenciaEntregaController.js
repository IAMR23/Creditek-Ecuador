const Entrega = require("../../models/Entrega");
const UsuarioAgencia = require("../../models/UsuarioAgencia");
const UsuarioAgenciaEntrega = require("../../models/UsuarioAgenciaEntrega");

const asignarEntrega = async (req, res) => {
  try {
    const { entregaId } = req.params;
    const { usuarioAgenciaId } = req.body;


    // 1️⃣ Validar existencia de la entrega
    const entrega = await Entrega.findByPk(entregaId);
    if (!entrega) {
      return res.status(404).json({
        message: "Entrega no encontrada",
      });
    }

    // 2️⃣ Validar existencia del usuario agencia
    const usuarioAgencia = await UsuarioAgencia.findOne({
      where: {
        id: usuarioAgenciaId,
        activo: true,
      },
    });

    if (!usuarioAgencia) {
      return res.status(404).json({
        message: "Usuario agencia no válido o inactivo",
      });
    }

    // 3️⃣ Verificar si ya está asignada (activa)
    const asignacionExistente = await UsuarioAgenciaEntrega.findOne({
      where: {
        entrega_id: entregaId,
        activo: true,
      },
    });
  
    if (asignacionExistente) {
      return res.status(409).json({
        message: "La entrega ya tiene un repartidor asignado",
      });
    }

    // 4️⃣ Crear asignación
    const asignacion = await UsuarioAgenciaEntrega.create({
      usuario_agencia_id: usuarioAgenciaId,
      entrega_id: entregaId,
      estado: "Asignada",
    });

    res.status(201).json({
      message: "Entrega asignada correctamente",
      asignacion,
    });
  } catch (error) {
    console.error("❌ Error asignando entrega:", error);
    res.status(500).json({
      message: "Error al asignar la entrega",
    });
  }
};

module.exports = {
  asignarEntrega,
};
