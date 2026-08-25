const express = require("express");
const router = express.Router();
const clienteController = require("../controllers/clienteController");
const { authenticate } = require("../middleware/authMiddleware");

// Crear cliente
router.post("/", clienteController.crearCliente);

// Listar todos los clientes
router.get("/", clienteController.listarClientes);

// Buscar clientes por nombre o cedula para autocompletados autenticados.
router.get("/buscar", authenticate, clienteController.buscarClientes);

// Buscar cliente por cedula. Debe declararse antes de la ruta dinamica por ID.
router.get("/cedula/:cedula", clienteController.buscarClientePorCedula);

// Obtener cliente por ID
router.get("/:id", clienteController.obtenerCliente);

// Actualizar cliente
router.put("/:id", clienteController.actualizarCliente);

// Eliminar cliente
router.delete("/:id", clienteController.eliminarCliente);

module.exports = router;
