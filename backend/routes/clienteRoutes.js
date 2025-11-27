const express = require("express");
const router = express.Router();
const clienteController = require("../controllers/clienteController");

// Crear cliente
router.post("/", clienteController.crearCliente);

// Listar todos los clientes
router.get("/", clienteController.listarClientes);

// Obtener cliente por ID
router.get("/:id", clienteController.obtenerCliente);

// Actualizar cliente
router.put("/:id", clienteController.actualizarCliente);

// Eliminar cliente
router.delete("/:id", clienteController.eliminarCliente);

module.exports = router;
