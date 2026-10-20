const path = require("path");
const express = require("express");
const multer = require("multer");

const { authenticate, requirePermission } = require("../../middleware/authMiddleware");
const controller = require("../../controllers/Gerencia/facturasController");
const {
  FACTURA_IMAGE_EXTENSIONS,
  MAX_FACTURA_IMAGE_BYTES,
  MAX_JSON_BYTES,
} = require("../../services/facturasService");

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 1, fileSize: MAX_JSON_BYTES },
  fileFilter: (_req, file, callback) =>
    path.extname(file.originalname || "").toLowerCase() === ".json"
      ? callback(null, true)
      : callback(new Error("Solo se permiten archivos con extension .json")),
});

const uploadExcel = multer({
  storage: multer.memoryStorage(),
  limits: { files: 1, fileSize: MAX_JSON_BYTES },
  fileFilter: (_req, file, callback) =>
    path.extname(file.originalname || "").toLowerCase() === ".xlsx"
      ? callback(null, true)
      : callback(new Error("Solo se permiten archivos Excel con extension .xlsx")),
});

const uploadFoto = multer({
  storage: multer.memoryStorage(),
  limits: { files: 1, fileSize: MAX_FACTURA_IMAGE_BYTES },
  fileFilter: (_req, file, callback) =>
    FACTURA_IMAGE_EXTENSIONS[file.mimetype]
      ? callback(null, true)
      : callback(new Error("La imagen debe ser JPG, PNG o WEBP")),
});

const cargarArchivo = (req, res, next) => {
  upload.single("archivo")(req, res, (error) => {
    if (!error) return next();
    return res.status(400).json({
      ok: false,
      message:
        error.code === "LIMIT_FILE_SIZE"
          ? "El archivo JSON supera el limite de 5 MB"
          : error.message || "No se pudo cargar el archivo JSON",
    });
  });
};

const capturarContenidoJson = (req, res, next) => {
  multer({
    limits: { fields: 1, fieldSize: MAX_JSON_BYTES },
  }).none()(req, res, (error) => {
    if (!error) return next();
    return res.status(400).json({
      ok: false,
      message:
        error.code === "LIMIT_FIELD_VALUE"
          ? "El contenido JSON supera el limite de 5 MB"
          : error.message || "No se pudo recibir el contenido JSON",
    });
  });
};

const cargarArchivoExcel = (req, res, next) => {
  uploadExcel.single("archivo")(req, res, (error) => {
    if (!error) return next();
    return res.status(400).json({
      ok: false,
      message:
        error.code === "LIMIT_FILE_SIZE"
          ? "El archivo Excel supera el limite de 5 MB"
          : error.message || "No se pudo cargar el archivo Excel",
    });
  });
};

const cargarFotoFactura = (req, res, next) => {
  uploadFoto.single("foto")(req, res, (error) => {
    if (!error) return next();
    return res.status(400).json({
      ok: false,
      message:
        error.code === "LIMIT_FILE_SIZE"
          ? "La imagen procesada no puede superar los 600 KB"
          : error.message || "No se pudo recibir la foto",
    });
  });
};

router.use(authenticate, requirePermission("Gerencia", "Administracion"));
router.get("/", controller.listar);
router.post("/carga-json", cargarArchivo, controller.cargarJson);
router.post(
  "/carga-json-texto",
  capturarContenidoJson,
  controller.cargarJsonTexto,
);
router.post("/carga-excel", cargarArchivoExcel, controller.cargarExcel);
router.post("/:id/foto", cargarFotoFactura, controller.cargarFoto);

module.exports = router;
