const Entrega = require("../../models/Entrega");

const TIPOS_ENTREGA = Object.freeze(["Entrega", "Envio"]);

const actualizarTipoEntrega = async (req, res) => {
  const { id } = req.params;
  const { tipoEntrega } = req.body;

  if (!TIPOS_ENTREGA.includes(tipoEntrega)) {
    return res.status(400).json({
      ok: false,
      message: "El tipo debe ser Entrega o Envío.",
    });
  }

  try {
    const entrega = await Entrega.findByPk(id);

    if (!entrega) {
      return res.status(404).json({
        ok: false,
        message: "Entrega no encontrada.",
      });
    }

    await entrega.update({ tipoEntrega });

    return res.json({
      ok: true,
      message: "Tipo de entrega actualizado.",
      entrega: {
        id: entrega.id,
        tipoEntrega: entrega.tipoEntrega,
      },
    });
  } catch (error) {
    console.error("Error actualizando el tipo de entrega:", error);
    return res.status(500).json({
      ok: false,
      message: "Error al actualizar el tipo de entrega.",
    });
  }
};

module.exports = {
  TIPOS_ENTREGA,
  actualizarTipoEntrega,
};
