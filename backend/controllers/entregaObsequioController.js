const EntregaObsequio = require("../models/EntregaObsequio");
const Obsequio = require("../models/Obsequio");
const Entrega = require("../models/Entrega");

exports.deleteEntregaObsequio = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Buscar el registro
    const registro = await EntregaObsequio.findByPk(id);

    if (!registro) {
      return res.status(404).json({ message: "El registro no existe" });
    }

    // 2. Eliminar
    await registro.destroy();

    res.json({ message: "Obsequio eliminado correctamente" });
  } catch (error) {
    console.error("Error al eliminar EntregaObsequio:", error);
    res.status(500).json({ message: "Error interno al eliminar entrega-obsequio" });
  }
};


exports.obtenerObsequiosEntrega = async (req, res) => {
  const { id } = req.params;

  try {
    const entrega = await Entrega.findByPk(id, {
      include: [
        {
          model: EntregaObsequio,
          as: "obsequiosEntrega", // alias de la relación Entrega -> EntregaObsequio
          include: [
            {
              model: Obsequio,
              as: "obsequio", // alias correcto de la relación EntregaObsequio -> Obsequio
              attributes: ["id", "nombre", "costoReferencial"],
            },
          ],
        },
      ],
    });

    if (!entrega) {
      return res.status(404).json({ message: "Entrega no encontrada" });
    }


    const obsequios = entrega.obsequiosEntrega
  ? entrega.obsequiosEntrega.map((ov) => ({
      id: ov.id,                  // ID del registro EntregaObsequio
      obsequioId: ov.obsequioId,  // ID real del obsequio
      cantidad: ov.cantidad,
      nombre: ov.obsequio?.nombre,
      costoReferencial: ov.obsequio?.costoReferencial,
    }))
  : [];

    res.json(obsequios);
  } catch (error) {
    console.error("Error al obtener obsequios:", error);
    res.status(500).json({ message: "Error del servidor" });
  }
};

exports.createEntregaObsequio = async (req, res) => {
  try {
    const { entregaId, obsequioId, cantidad } = req.body;
    console.log(entregaId)
    if (!entregaId || !obsequioId) {
      return res.status(400).json({ message: "entregaId y obsequioId son requeridos" });
    }

    // 🔥 Verificar si ya existe ese obsequio en esa entrega
    const existente = await EntregaObsequio.findOne({
      where: { entregaId, obsequioId }
    });

    if (existente) {
      return res.status(409).json({
        message: "Este obsequio ya ha sido agregado a esta entrega"
      });
    }

    const nuevo = await EntregaObsequio.create({
      entregaId,
      obsequioId,
      cantidad: cantidad || 1,
    });
 
    res.status(201).json(nuevo);
  } catch (error) {
    console.error("Error al crear EntregaObsequio:", error);
    res.status(500).json({ message: "Error interno al crear entrega-obsequio" });
  }
};


// Obtener todos los registros 
exports.getEntregaObsequios = async (req, res) => {
  try {
    const lista = await EntregaObsequio.findAll({
      include: [
        { model: Entrega, as: "entrega", attributes: ["id", "clienteId"] },
        { model: Obsequio, as: "obsequio", attributes: ["id", "nombre", "costoReferencial"] },
      ],
    });

    res.json(lista);
  } catch (error) {
    console.error("Error al obtener EntregaObsequios:", error);
    res.status(500).json({ message: "Error interno" });
  }
};

// Obtener uno por ID
exports.getEntregaObsequio = async (req, res) => {
  try {
    const { id } = req.params;

    const encontrado = await EntregaObsequio.findByPk(id, {
      include: [
        { model: Entrega, as: "entrega", attributes: ["id", "clienteId"] },
        { model: Obsequio, as: "obsequio", attributes: ["id", "nombre", "costoReferencial"] },
      ],
    });

    if (!encontrado) {
      return res.status(404).json({ message: "No encontrado" });
    }

    res.json(encontrado);
  } catch (error) {
    console.error("Error al obtener EntregaObsequio:", error);
    res.status(500).json({ message: "Error interno" });
  }
};

// Actualizar
exports.updateEntregaObsequio = async (req, res) => {
  try {
    const { id } = req.params;
    const { obsequioId, cantidad } = req.body;

    const registro = await EntregaObsequio.findByPk(id);

    if (!registro) {
      return res.status(404).json({ message: "No encontrado" });
    }

    await registro.update({
      obsequioId: obsequioId || registro.obsequioId,
      cantidad: cantidad || registro.cantidad,
    });

    res.json({ message: "Actualizado correctamente", registro });
  } catch (error) {
    console.error("Error al actualizar EntregaObsequio:", error);
    res.status(500).json({ message: "Error interno" });
  }
};

// Eliminar
exports.deleteEntregaObsequio = async (req, res) => {
  try {
    const { id } = req.params;

    const registro = await EntregaObsequio.findByPk(id);

    if (!registro) {
      return res.status(404).json({ message: "No encontrado" });
    }

    await registro.destroy();

    res.json({ message: "Eliminado correctamente" });
  } catch (error) {
    console.error("Error al eliminar EntregaObsequio:", error);
    res.status(500).json({ message: "Error interno" });
  }
};
