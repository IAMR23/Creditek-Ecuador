const express = require("express");
const {
  actualizarLecturaAlertaPersonal,
  listarAlertasPersonal,
  marcarTodasLasAlertasLeidas,
} = require("../controllers/alertasPersonalController");
const { authenticate, requirePermission } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(
  authenticate,
  requirePermission("Administracion", "Desarrollo Organizacional", "Gerencia"),
);
router.get("/", listarAlertasPersonal);
router.patch("/leidas/todas", marcarTodasLasAlertasLeidas);
router.patch("/:id/lectura", actualizarLecturaAlertaPersonal);

module.exports = router;
