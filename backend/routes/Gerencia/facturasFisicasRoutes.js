const path = require("path");
const express = require("express");
const multer = require("multer");

const {
  authenticate,
  requirePermission,
} = require("../../middleware/authMiddleware");
const controller = require("../../controllers/Gerencia/facturasFisicasController");
const {
  MAX_FILE_SIZE_BYTES,
  MIME_EXTENSIONS,
} = require("../../services/facturasFisicasService");

const router = express.Router();
const requireGerencia = requirePermission("Gerencia", "Administracion");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 1,
    fileSize: MAX_FILE_SIZE_BYTES,
  },
  fileFilter: (_req, file, cb) => {
    const extension = path.extname(file.originalname || "").toLowerCase();
    const permitidas = MIME_EXTENSIONS[file.mimetype] || [];

    if (!permitidas.includes(extension)) {
      return cb(new Error("Solo se permiten archivos JPG, JPEG, PNG, WEBP o PDF"));
    }

    return cb(null, true);
  },
});

const cargarArchivo = (req, res, next) => {
  upload.single("archivo")(req, res, (error) => {
    if (!error) return next();

    const message =
      error.code === "LIMIT_FILE_SIZE"
        ? "El archivo supera el limite de 15 MB"
        : error.message || "No se pudo cargar el archivo";

    return res.status(400).json({ ok: false, message });
  });
};

router.use(authenticate, requireGerencia);

router.get("/", controller.listarFacturas);
router.post("/", cargarArchivo, controller.subirFactura);
router.get("/:id", controller.obtenerFactura);
router.get("/:id/archivo", controller.verArchivo);
router.post("/:id/ocr", controller.procesarOcr);
router.patch("/:id/aplicar-ocr", controller.aplicarOcr);
router.get("/:id/productos-ocr", controller.listarProductosOcr);
router.patch("/:id/productos-ocr/:productoId", controller.editarProductoOcr);
router.patch(
  "/:id/productos-ocr/:productoId/confirmar",
  controller.confirmarProductoOcr,
);
router.patch(
  "/:id/productos-ocr/:productoId/descartar",
  controller.descartarProductoOcr,
);
router.patch("/:id", controller.actualizarFactura);
router.patch("/:id/anular", controller.anularFactura);

module.exports = router;
