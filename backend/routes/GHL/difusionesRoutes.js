const express = require("express");
const multer = require("multer");
const controller = require("../../controllers/GHL/difusionesController");
const {
  authenticate,
  requireAdminRole,
  requirePermission,
} = require("../../middleware/authMiddleware");
const {
  BROADCAST_IMAGE_TYPES,
  MAX_BROADCAST_IMAGE_BYTES,
} = require("../../services/ghlBroadcastMediaService");

const router = express.Router();
const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { files: 1, fileSize: MAX_BROADCAST_IMAGE_BYTES },
  fileFilter: (_req, file, callback) => BROADCAST_IMAGE_TYPES[file.mimetype]
    ? callback(null, true)
    : callback(new Error("La imagen debe ser JPG, PNG o WEBP")),
});

const receiveImage = (req, res, next) => {
  uploadImage.single("imagen")(req, res, (error) => {
    if (!error) return next();
    return res.status(400).json({
      ok: false,
      code: error.code || "GHL_BROADCAST_IMAGE_INVALID",
      message: error.code === "LIMIT_FILE_SIZE"
        ? "La imagen no puede superar los 5 MB"
        : error.message || "No se pudo recibir la imagen",
    });
  });
};

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
router.post("/imagenes", receiveImage, controller.uploadImage);
router.post("/mensajes", controller.createSavedMessage);
router.put("/mensajes/:id", controller.updateSavedMessage);
router.delete("/mensajes/:id", controller.deleteSavedMessage);
router.get("/categorias", controller.categories);
router.post("/categorias", controller.createCategory);
router.put("/categorias/:id", controller.updateCategory);
router.delete("/categorias/:id", controller.deleteCategory);
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
