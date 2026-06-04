const express = require("express");
const router = express.Router();
const permisoController = require("../controllers/permisoController");

// Crear permiso
router.post("/", permisoController.crearPermiso);

// Sincronizar permisos desde las rutas del sistema
router.post("/sincronizar", permisoController.sincronizarPermisos);

// Listar permisos
router.get("/", permisoController.listarPermisos);

module.exports = router;
