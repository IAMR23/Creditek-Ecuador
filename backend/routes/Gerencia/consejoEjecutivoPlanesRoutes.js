const express = require("express");
const {
  authenticate,
  requirePermission,
} = require("../../middleware/authMiddleware");
const controller = require("../../controllers/Gerencia/consejoEjecutivoPlanesController");
const salasController = require("../../controllers/Gerencia/consejoEjecutivoSalasController");

const router = express.Router();

router.use(authenticate, requirePermission("Gerencia", "Administracion"));

router.get("/responsables", controller.listarResponsables);
router.get("/salas", salasController.listarSalas);
router.post("/salas", requirePermission("Gerencia"), salasController.crearSala);
router.put(
  "/salas/:id",
  requirePermission("Gerencia"),
  salasController.actualizarSala,
);
router.get("/", controller.listarPlanes);
router.post("/", controller.crearPlan);
router.put("/:id", controller.actualizarPlan);

module.exports = router;
