const express = require("express");
const router = express.Router();
const permisoController = require("../controllers/permisoController");
const { authenticate, requirePermission } = require("../middleware/authMiddleware");

// Crear permiso
router.post("/", authenticate, requirePermission("Administracion"), permisoController.crearPermiso);

// Sincronizar permisos desde las rutas del sistema
router.post(
  "/sincronizar",
  authenticate,
  requirePermission("Administracion"),
  permisoController.sincronizarPermisos,
);

// Listar permisos
router.get(
  "/",
  authenticate,
  requirePermission("Administracion"),
  permisoController.listarPermisos,
);

// Eliminar permiso y quitarlo de todos los usuarios asociados
router.delete(
  "/:id",
  authenticate,
  requirePermission("Administracion"),
  permisoController.eliminarPermiso,
);

module.exports = router;
