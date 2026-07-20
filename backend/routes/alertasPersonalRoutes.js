const express = require("express");
const { listarAlertasPersonal } = require("../controllers/alertasPersonalController");
const { authenticate, requirePermission } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(
  authenticate,
  requirePermission("Administracion", "Desarrollo Organizacional", "Gerencia"),
);
router.get("/", listarAlertasPersonal);

module.exports = router;
