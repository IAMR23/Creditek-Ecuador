const express = require("express");
const controller = require("../../controllers/GHL/workflowProgramacionesController");
const { authenticate, requirePermission } = require("../../middleware/authMiddleware");

const router = express.Router();
router.use(authenticate, requirePermission("Gerencia", "Administracion", "Sistemas"));
router.get("/catalogos/pipelines", controller.pipelines);
router.get("/catalogos/pipelines/:pipelineId/stages", controller.stages);
router.get("/catalogos/workflows", controller.workflows);
router.get("/programaciones", controller.list);
router.get("/programaciones/:id", controller.get);
router.post("/vista-previa", controller.previewInput);
router.post("/programaciones", controller.create);
router.put("/programaciones/:id", controller.update);
router.patch("/programaciones/:id/estado", controller.state);
router.post("/programaciones/:id/vista-previa", controller.preview);
router.get("/ejecuciones", controller.history);
router.get("/ejecuciones/:id", controller.execution);

module.exports = router;
