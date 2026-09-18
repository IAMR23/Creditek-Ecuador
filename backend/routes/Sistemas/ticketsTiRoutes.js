const express = require("express");
const controller = require("../../controllers/Sistemas/ticketsTiController");
const { authenticate } = require("../../middleware/authMiddleware");
const { procesarArchivosTickets } = require("../../middleware/uploadTicketsTi");

const router = express.Router();

router.use(authenticate);
router.get("/dashboard", controller.dashboard);
router.get("/kanban", controller.listarKanban);
router.get("/responsables", controller.responsables);
router.get("/", controller.listar);
router.post("/", procesarArchivosTickets, controller.crear);
router.get("/:id", controller.detalle);
router.patch("/:id", controller.actualizar);
router.post("/:id/comentarios", controller.comentar);
router.post("/:id/archivos", procesarArchivosTickets, controller.adjuntar);
router.get("/:id/archivos/:archivoId/descargar", controller.descargar);

module.exports = router;
