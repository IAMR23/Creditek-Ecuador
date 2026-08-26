const express = require("express");
const controller = require("../../controllers/Sistemas/reporteCajaAgenciasController");
const { authenticate, requirePermission } = require("../../middleware/authMiddleware");

const router = express.Router();

router.use(authenticate, requirePermission("Sistemas", "Administracion"));
router.get("/", controller.listar);
router.post("/", controller.crear);
router.put("/:id", controller.actualizar);
router.delete("/:id", controller.eliminar);

module.exports = router;
