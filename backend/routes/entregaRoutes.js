const express = require("express");
const router = express.Router();
const entregaController = require("../controllers/entregaController");

// Crear entrega
router.post("/", entregaController.crearEntrega);

// Listar todas las entregas
router.get("/", entregaController.listarEntregas);

// Filtrar entregas
router.get("/filter", entregaController.filtrarEntregas);

// Obtener entrega por ID
router.get("/:id", entregaController.obtenerEntrega);
router.patch("/:id/estado", entregaController.cambiarEstadoEntrega);

// Actualizar entrega
router.put("/:id", entregaController.actualizarEntrega);

// Eliminar entrega
router.delete("/:id", entregaController.eliminarEntrega);

module.exports = router;
