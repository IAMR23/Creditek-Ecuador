// routes/rolRoutes.js
const express = require('express');
const router = express.Router();
const rolController = require('../controllers/rolController');

// Rutas de roles
router.get('/', rolController.obtenerRoles); // Listar todos los roles
router.get('/:id', rolController.obtenerRolPorId); // Obtener un rol por ID
router.post('/', rolController.crearRol); // Crear un nuevo rol
router.put('/:id', rolController.actualizarRol); // Actualizar un rol
router.delete('/:id', rolController.eliminarRol); // Eliminar (soft delete) un rol

module.exports = router;
