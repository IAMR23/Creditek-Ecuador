const express = require("express");
const router = express.Router();

const { authenticate, requirePermission } = require("../../middleware/authMiddleware");
const controller = require("../../controllers/Contabilidad/nominaController");

const requireNomina = requirePermission("Contabilidad", "Administracion");

router.use(authenticate, requireNomina);

router.get("/", controller.listarNomina);
router.get("/usuario/:usuarioId", controller.obtenerPorUsuario);
router.post("/usuario-agencia/:usuarioAgenciaId", controller.crearSiNoExiste);
router.put("/:id", controller.actualizarNomina);

module.exports = router;
