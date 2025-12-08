const express = require("express");
const router = express.Router();
const DetalleEntrega = require("../models/DetalleEntrega");
const DispositivoMarca = require("../models/DispositivoMarca");
const Modelo = require("../models/Modelo");
const Dispositivo = require("../models/Dispositivo");
const Marca = require("../models/Marca");

router.get("/entrega/:entregaId", async (req, res) => {
  try {
    const { entregaId } = req.params;

    if (!entregaId) {
      return res.status(400).json({ error: "El entregaId es obligatorio." });
    }

    const detalles = await DetalleEntrega.findAll({
      where: { entregaId },
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
    return res.status(500).json({ error: "Error al obtener los detalles de la entrega." });
  }
});


// Listar todos los detalles de entrega
router.get("/", async (req, res) => {
  try {
    const detalles = await DetalleEntrega.findAll({
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

// Obtener un detalle de entrega por id
router.get("/:id", async (req, res) => {
  try {
    const detalle = await DetalleEntrega.findByPk(req.params.id, {
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

// Crear un nuevo detalle de entrega
router.post("/", async (req, res) => {
  try {
    const nuevoDetalle = await DetalleEntrega.create({
      ...req.body,
    });
    res.status(201).json(nuevoDetalle);
  } catch (error) {
    res.status(500).json({ error: error.message });
    console.log(error)
  }
});

// Actualizar un detalle de entrega
router.put("/:id", async (req, res) => {
  try {
    const detalle = await DetalleEntrega.findByPk(req.params.id);
    if (!detalle) return res.status(404).json({ message: "No encontrado" });
    await detalle.update(req.body);
    res.json(detalle);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Eliminar un detalle de entrega
router.delete("/:id", async (req, res) => {
  try {
    const detalle = await DetalleEntrega.findByPk(req.params.id);
    if (!detalle) return res.status(404).json({ message: "No encontrado" });
    await detalle.destroy();
    res.json({ message: "Eliminado correctamente" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
