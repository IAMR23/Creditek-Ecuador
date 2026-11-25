const express = require("express");
const multer = require("multer");

const {
  authenticate,
  requirePermission,
} = require("../../middleware/authMiddleware");
const controller = require("../../controllers/Repartidor/facturasController");
const {
  FACTURA_IMAGE_EXTENSIONS,
  MAX_FACTURA_IMAGE_BYTES,
} = require("../../services/facturasService");

const router = express.Router();
const normalize = (value) => String(value || "").trim().toLowerCase();
const requireRepartidor = (req, res, next) =>
  normalize(req.user?.rol) === "repartidor"
    ? next()
    : res.status(403).json({ message: "Esta accion requiere rol de repartidor." });

const uploadFoto = multer({
  storage: multer.memoryStorage(),
  limits: { files: 1, fileSize: MAX_FACTURA_IMAGE_BYTES },
  fileFilter: (_req, file, callback) =>
    FACTURA_IMAGE_EXTENSIONS[file.mimetype]
      ? callback(null, true)
      : callback(new Error("La imagen procesada debe estar en formato WEBP")),
});

const cargarFoto = (req, res, next) => {
  uploadFoto.single("foto")(req, res, (error) => {
    if (!error) return next();
    return res.status(400).json({
      ok: false,
      message:
        error.code === "LIMIT_FILE_SIZE"
          ? "La imagen WebP procesada no puede superar los 600 KB"
          : error.message || "No se pudo recibir la foto",
    });
  });
};

router.use(authenticate, requirePermission("Logistica"), requireRepartidor);
router.post("/", cargarFoto, controller.cargarFoto);

module.exports = router;
