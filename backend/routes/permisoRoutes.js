const express = require("express");
const router = express.Router();
const permisoController = require("../controllers/permisoController");

// Crear permiso
router.post("/", permisoController.crearPermiso);

// Listar permisos
router.get("/", permisoController.listarPermisos);

module.exports = router;
