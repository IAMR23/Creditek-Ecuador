// routes/marcaRoutes.js
const express = require("express");
const router = express.Router();
const marcaController = require("../controllers/marcaController");

// ===========================
// 🔹 RUTAS CRUD MARCA
// ===========================

// Crear marca
router.post("/", marcaController.crearMarca);

// Listar todas las marcas
router.get("/", marcaController.listarMarcas);

// Obtener marca por ID
router.get("/:id", marcaController.obtenerMarca);

// Actualizar marca
router.put("/:id", marcaController.actualizarMarca);

// Eliminar marca
router.delete("/:id", marcaController.eliminarMarca);

module.exports = router;
