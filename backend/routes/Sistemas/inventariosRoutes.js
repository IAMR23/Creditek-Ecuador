const express = require("express");
const controller = require("../../controllers/Sistemas/inventariosController");
const { authenticate, requirePermission } = require("../../middleware/authMiddleware");

const router = express.Router();

router.use(authenticate, requirePermission("Sistemas", "Administracion"));

router.get("/", controller.listar);
router.get("/catalogos", controller.catalogos);
router.post("/lote", controller.guardarLote);
router.post("/", controller.crear);
router.put("/:id", controller.actualizar);
router.delete("/:id", controller.eliminar);

module.exports = router;
