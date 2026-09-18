const express = require("express");
const controller = require("../../controllers/Sistemas/capacitacionController");
const {
  authenticate,
  requirePermission,
} = require("../../middleware/authMiddleware");

const router = express.Router();
const puedeAdministrar = requirePermission("Sistemas", "Administracion");

router.use(authenticate);
router.get("/", controller.listar);
router.post("/", puedeAdministrar, controller.crear);
router.patch("/:id", puedeAdministrar, controller.actualizar);

module.exports = router;
