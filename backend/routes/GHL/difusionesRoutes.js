const express = require("express");
const controller = require("../../controllers/GHL/difusionesController");
const {
  authenticate,
  requireAdminRole,
  requirePermission,
} = require("../../middleware/authMiddleware");

const router = express.Router();

router.use(
  authenticate,
  requirePermission("Sistemas", "Administracion"),
  requireAdminRole,
);
router.get("/estado", controller.status);
router.get("/contactos", controller.contacts);
router.get("/etiquetas", controller.tags);
router.get("/catalogos/pipelines", controller.pipelines);
router.get("/mensajes", controller.savedMessages);
router.post("/mensajes", controller.createSavedMessage);
router.put("/mensajes/:id", controller.updateSavedMessage);
router.delete("/mensajes/:id", controller.deleteSavedMessage);
router.get("/listas", controller.smartLists);
router.post("/listas", controller.createSmartList);
router.get("/listas/:id/contactos", controller.smartListContacts);
router.put("/listas/:id", controller.updateSmartList);
router.delete("/listas/:id", controller.deleteSmartList);
router.post("/vista-previa", controller.preview);
router.post("/enviar", controller.send);
router.get("/ejecuciones/activa", controller.activeExecution);
router.get("/ejecuciones", controller.executions);
router.get("/ejecuciones/:id", controller.execution);
router.post("/ejecuciones/:id/cancelar", controller.cancelExecution);

module.exports = router;
