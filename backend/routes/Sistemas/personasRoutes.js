const express = require("express");
const controller = require("../../controllers/Sistemas/personasController");
const { authenticate, requirePermission } = require("../../middleware/authMiddleware");

const router = express.Router();

router.use(authenticate, requirePermission("Sistemas", "Administracion"));

router.get("/catalogos", controller.catalogos);
router.get("/", controller.listar);
router.post("/", controller.crear);
router.put("/:id", controller.actualizar);

module.exports = router;
