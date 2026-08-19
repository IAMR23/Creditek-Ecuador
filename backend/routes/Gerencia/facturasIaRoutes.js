const path = require("path");
const express = require("express");
const multer = require("multer");

const { authenticate, requirePermission } = require("../../middleware/authMiddleware");
const controller = require("../../controllers/Gerencia/facturasIaController");
const { MAX_JSON_BYTES } = require("../../services/facturasIaService");

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 1, fileSize: MAX_JSON_BYTES },
  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname || "").toLowerCase();
    return extension === ".json"
      ? callback(null, true)
      : callback(new Error("Solo se permiten archivos con extension .json"));
  },
});

const cargarArchivoJson = (req, res, next) => {
  upload.single("archivo")(req, res, (error) => {
    if (!error) return next();
    const message = error.code === "LIMIT_FILE_SIZE"
      ? "El archivo JSON supera el limite de 2 MB"
      : error.message || "No se pudo cargar el archivo JSON";
    return res.status(400).json({ ok: false, message });
  });
};

router.use(authenticate, requirePermission("Gerencia", "Administracion"));
router.get("/", controller.listar);
router.get("/exportacion", controller.exportarDatos);
router.post("/", cargarArchivoJson, controller.cargarJson);
router.get("/:id", controller.obtener);
router.patch("/:id/seleccionar", controller.seleccionar);

module.exports = router;
