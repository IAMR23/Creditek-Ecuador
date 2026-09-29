const path = require("path");
const crypto = require("crypto");
const express = require("express");
const multer = require("multer");

const { authenticate, requirePermission } = require("../../middleware/authMiddleware");
const { requireUphoneApiKey } = require("../../middleware/uphoneApiKeyMiddleware");
const controller = require("../../controllers/Gerencia/uphoneSolicitudesController");
const { MAX_FILE_SIZE_BYTES } = require("../../services/uphoneSolicitudesService");
const uphoneLogger = require("../../utils/uphoneLogger");

const router = express.Router();
router.use((req, res, next) => {
  req.uphoneRequestId = crypto.randomUUID();
  res.setHeader("X-Request-Id", req.uphoneRequestId);
  next();
});
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 1, fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname || "").toLowerCase();
    return extension === ".xlsx"
      ? callback(null, true)
      : callback(new Error("Solo se permiten archivos Excel .xlsx"));
  },
});

const cargarExcel = (req, res, next) => {
  upload.single("archivo")(req, res, (error) => {
    if (!error) {
      uphoneLogger.info("archivo recibido", {
        requestId: req.uphoneRequestId,
        bytes: req.file?.size,
        mimeType: req.file?.mimetype,
      });
      return next();
    }
    const message =
      error.code === "LIMIT_FILE_SIZE"
        ? "El archivo Excel supera el limite de 10 MB"
        : error.message || "No se pudo recibir el archivo Excel";
    uphoneLogger.warn("archivo rechazado", {
      requestId: req.uphoneRequestId,
      multerCode: error.code,
      message,
    });
    return res.status(400).json({ ok: false, code: "ARCHIVO_INVALIDO", message });
  });
};

// La computadora integradora carga el Excel con API key y sin JWT.
router.post("/importar", requireUphoneApiKey, cargarExcel, controller.importarApiKey);

// La consulta desde la interfaz RVE conserva autenticacion y permisos de usuario.
router.use(
  authenticate,
  requirePermission("Gerencia", "Administracion", "Sistemas"),
);
router.get("/exportar", controller.exportar);
router.get("/", controller.listar);
router.delete("/:id", controller.eliminar);
router.post("/importar-manual", cargarExcel, controller.importarManual);

module.exports = router;
