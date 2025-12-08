const VentaObsequio = require("../models/VentaObsequio");
const Obsequio = require("../models/Obsequio");
const Venta = require("../models/Venta");

exports.deleteVentaObsequio = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Buscar el registro
    const registro = await VentaObsequio.findByPk(id);

    if (!registro) {
      return res.status(404).json({ message: "El registro no existe" });
    }

    // 2. Eliminar
    await registro.destroy();

    res.json({ message: "Obsequio eliminado correctamente" });
  } catch (error) {
    console.error("Error al eliminar VentaObsequio:", error);
    res.status(500).json({ message: "Error interno al eliminar venta-obsequio" });
  }
};


exports.obtenerObsequiosVenta = async (req, res) => {
  const { id } = req.params;

  try {
    const venta = await Venta.findByPk(id, {
      include: [
        {
          model: VentaObsequio,
          as: "obsequiosVenta", // alias de la relación Venta -> VentaObsequio
          include: [
            {
              model: Obsequio,
              as: "obsequio", // alias correcto de la relación VentaObsequio -> Obsequio
              attributes: ["id", "nombre", "costoReferencial"],
            },
          ],
        },
      ],
    });

    if (!venta) {
      return res.status(404).json({ message: "Venta no encontrada" });
    }


    const obsequios = venta.obsequiosVenta
  ? venta.obsequiosVenta.map((ov) => ({
      id: ov.id,                  // ID del registro VentaObsequio
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

exports.createVentaObsequio = async (req, res) => {
  try {
    const { ventaId, obsequioId, cantidad } = req.body;

    if (!ventaId || !obsequioId) {
      return res.status(400).json({ message: "ventaId y obsequioId son requeridos" });
    }

    // 🔥 Verificar si ya existe ese obsequio en esa venta
    const existente = await VentaObsequio.findOne({
      where: { ventaId, obsequioId }
    });

    if (existente) {
      return res.status(409).json({
        message: "Este obsequio ya ha sido agregado a esta venta"
      });
    }

    const nuevo = await VentaObsequio.create({
      ventaId,
      obsequioId,
      cantidad: cantidad || 1,
    });

    res.status(201).json(nuevo);
  } catch (error) {
    console.error("Error al crear VentaObsequio:", error);
    res.status(500).json({ message: "Error interno al crear venta-obsequio" });
  }
};


// Obtener todos los registros 
exports.getVentaObsequios = async (req, res) => {
  try {
    const lista = await VentaObsequio.findAll({
      include: [
        { model: Venta, as: "venta", attributes: ["id", "clienteId"] },
        { model: Obsequio, as: "obsequio", attributes: ["id", "nombre", "costoReferencial"] },
      ],
    });

    res.json(lista);
  } catch (error) {
    console.error("Error al obtener VentaObsequios:", error);
    res.status(500).json({ message: "Error interno" });
  }
};

// Obtener uno por ID
exports.getVentaObsequio = async (req, res) => {
  try {
    const { id } = req.params;

    const encontrado = await VentaObsequio.findByPk(id, {
      include: [
        { model: Venta, as: "venta", attributes: ["id", "clienteId"] },
        { model: Obsequio, as: "obsequio", attributes: ["id", "nombre", "costoReferencial"] },
      ],
    });

    if (!encontrado) {
      return res.status(404).json({ message: "No encontrado" });
    }

    res.json(encontrado);
  } catch (error) {
    console.error("Error al obtener VentaObsequio:", error);
    res.status(500).json({ message: "Error interno" });
  }
};

// Actualizar
exports.updateVentaObsequio = async (req, res) => {
  try {
    const { id } = req.params;
    const { obsequioId, cantidad } = req.body;

    const registro = await VentaObsequio.findByPk(id);

    if (!registro) {
      return res.status(404).json({ message: "No encontrado" });
    }

    await registro.update({
      obsequioId: obsequioId || registro.obsequioId,
      cantidad: cantidad || registro.cantidad,
    });

    res.json({ message: "Actualizado correctamente", registro });
  } catch (error) {
    console.error("Error al actualizar VentaObsequio:", error);
    res.status(500).json({ message: "Error interno" });
  }
};

// Eliminar
exports.deleteVentaObsequio = async (req, res) => {
  try {
    const { id } = req.params;

    const registro = await VentaObsequio.findByPk(id);

    if (!registro) {
      return res.status(404).json({ message: "No encontrado" });
    }

    await registro.destroy();

    res.json({ message: "Eliminado correctamente" });
  } catch (error) {
    console.error("Error al eliminar VentaObsequio:", error);
    res.status(500).json({ message: "Error interno" });
  }
};
