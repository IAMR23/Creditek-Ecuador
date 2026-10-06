const express = require("express");
const controller = require("../../controllers/Logistica/combustibleController");
const {
  authenticate,
  requirePermission,
  requireAdminRole,
} = require("../../middleware/authMiddleware");
const { esRepartidor } = require("../../utils/logisticaCombustible");

const router = express.Router();
const permisoAdministrador = requirePermission("Logistica", "Administracion");
const acceso = (req, res, next) => {
  if (esRepartidor(req.user)) return next();
  return requireAdminRole(req, res, () => permisoAdministrador(req, res, next));
};
const soloRepartidor = (req, res, next) =>
  esRepartidor(req.user)
    ? next()
    : res
        .status(403)
        .json({
          ok: false,
          message: "Esta acción requiere rol de repartidor.",
        });

router.use(authenticate, acceso);
router.get("/repartidores", requireAdminRole, controller.repartidores);
router.get("/", controller.listar);
router.get("/:id", controller.obtener);
router.post("/", soloRepartidor, controller.crear);
router.put("/:id", soloRepartidor, controller.actualizar);
router.delete("/:id", controller.eliminar);

module.exports = router;
