const express = require("express");
const {
  asignar,
  listar,
} = require("../../controllers/Sistemas/uphoneUsuariosNormalizacionController");
const {
  authenticate,
  requirePermission,
} = require("../../middleware/authMiddleware");

const router = express.Router();

router.use(authenticate, requirePermission("Sistemas", "Administracion"));
router.get("/", listar);
router.put("/:usuarioUphone", asignar);

module.exports = router;
