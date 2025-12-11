const express = require("express");
const router = express.Router();
const DetalleVenta = require("../models/DetalleVenta");
const DispositivoMarca = require("../models/DispositivoMarca");
const Modelo = require("../models/Modelo");
const Dispositivo = require("../models/Dispositivo");
const Marca = require("../models/Marca");

router.get("/venta/:ventaId", async (req, res) => {
  try {
    const { ventaId } = req.params;

    if (!ventaId) {
      return res.status(400).json({ error: "El ventaId es obligatorio." });
    }

    const detalles = await DetalleVenta.findAll({
      where: { ventaId },
      include: [
        {
          model: DispositivoMarca,
          as: "dispositivoMarca",
          include: [
            {
              model: Modelo,
              as: "modelos",
              attributes: ["id", "nombre"],
            },
            {
              model: Dispositivo,         // <-- AQUI
              as: "dispositivo",
              attributes: ["id", "nombre"]
            },
            {
              model: Marca,              // <-- AQUI
              as: "marca",
              attributes: ["id", "nombre"]
            }
          ]
        }
      ],
      order: [["id", "ASC"]]
    });

    return res.json(detalles);
  } catch (error) {
    console.error("Error obteniendo detalles:", error);
    return res.status(500).json({ error: "Error al obtener los detalles de la venta." });
  }
});


// Listar todos los detalles de venta
router.get("/", async (req, res) => {
  try {
    const detalles = await DetalleVenta.findAll({
      include: [
        {
          model: DispositivoMarca,
          as: "dispositivoMarca",
        },
        {
          model: Modelo,
          as: "modelo",
        },
      ],
    });
    res.json(detalles);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener un detalle de venta por id
router.get("/:id", async (req, res) => {
  try {
    const detalle = await DetalleVenta.findByPk(req.params.id, {
      include: [
        {
          model: DispositivoMarca,
          as: "dispositivoMarca",
        },
        {
          model: Modelo,
          as: "modelo",
        },
      ],
    });
    if (!detalle) return res.status(404).json({ message: "No encontrado" });
    res.json(detalle);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Crear un nuevo detalle de venta
router.post("/", async (req, res) => {
  try {
    const nuevoDetalle = await DetalleVenta.create({
      ...req.body,
    });
    res.status(201).json(nuevoDetalle);
  } catch (error) {
    res.status(500).json({ error: error.message });
    console.log(error) 
  }
});

router.put("/:id", async (req, res) => {
  try {
    const detalle = await DetalleVenta.findByPk(req.params.id);
    if (!detalle) return res.status(404).json({ message: "No encontrado" });
    await detalle.update(req.body);
    res.json(detalle);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Eliminar un detalle de venta
router.delete("/:id", async (req, res) => {
  try {
    const detalle = await DetalleVenta.findByPk(req.params.id);
    if (!detalle) return res.status(404).json({ message: "No encontrado" });
    await detalle.destroy();
    res.json({ message: "Eliminado correctamente" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
