const express = require("express");
const router = express.Router();
const productoController = require("../controllers/productoController");
const axios = require("axios");
const Producto = require("../models/Producto");
const { Op } = require("sequelize");

const API_CONTIFICO = process.env.API_CONTIFICO;
const API_KEY = process.env.API_KEY;

// ================================
// GET /productos  (único y CORRECTO)
// ================================
router.get("/", async (req, res) => {
  try {
    const { filtro } = req.query;

    let productosLocales = [];

    // 1. Buscar primero en tu base local
    if (filtro) {
      productosLocales = await Producto.findAll({
        where: {
          nombre: {
            [Op.iLike]: `%${filtro}%`
          }
        }
      });
    } else {
      productosLocales = await Producto.findAll();
    }

    // Si encontró algo en tu base → devolverlo
    if (productosLocales.length > 0) {
      return res.json(productosLocales);
    }

    // 2. Si NO hay locales, traer Contífico
    const url = `${API_CONTIFICO}/producto${filtro ? `?filtro=${filtro}` : ""}`;

    const response = await axios.get(url, {
      headers: {
        Authorization: `${API_KEY}`
      }
    });

    const productosContifico = response.data;

    // 3. Guardar productos nuevos en tu base
    for (const p of productosContifico) {
      const existe = await Producto.findOne({
        where: { contifico_id: p.id },
      });

      if (!existe) {
        await Producto.create({
          contifico_id: p.id,
          nombre: p.nombre,
          activo: true,
        });
      }
    }

    // 4. Devolver productos de Contífico
    res.json(productosContifico);

  } catch (error) {
    console.error("Error en controlador de productos:", error);
    res.status(500).json({ error: "Error obteniendo productos" });
  }
});

// ================================
// Rutas CRUD restantes
// ================================

// Crear producto manual
router.post("/", productoController.crearProducto);

// Obtener producto por ID
router.get("/:id", productoController.obtenerProducto);

// Actualizar
router.put("/:id", productoController.actualizarProducto);

// Eliminar
router.delete("/:id", productoController.eliminarProducto);

module.exports = router;
