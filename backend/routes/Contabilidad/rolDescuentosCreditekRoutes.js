const router = require("express").Router();
const { authenticate, requirePermission } = require("../../middleware/authMiddleware");
const controller = require("../../controllers/Contabilidad/rolDescuentosCreditekController");
router.use(authenticate, requirePermission("Contabilidad", "Administracion"));
router.get("/", controller.obtener);
router.post("/", controller.crear);
router.put("/:id", controller.actualizar);
router.patch("/:id/estado", controller.cambiarEstado);
module.exports = router;
