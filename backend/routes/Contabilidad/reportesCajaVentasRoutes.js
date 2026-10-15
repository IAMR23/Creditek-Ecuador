const crypto = require("crypto");
const fs = require("fs");
const fsp = require("fs/promises");
const os = require("os");
const path = require("path");
const express = require("express");
const multer = require("multer");

const {
  authenticate,
  requirePermission,
} = require("../../middleware/authMiddleware");
const {
  requireReportesCajaCelularesApiKey,
  requireReportesCajaTelevisionesApiKey,
} = require("../../middleware/reportesCajaApiKeyMiddleware");
const controller = require("../../controllers/Contabilidad/reportesCajaVentasController");

const router = express.Router();
const requireContabilidad = requirePermission("Contabilidad", "Administracion");
const uploadRoot =
  process.env.REPORTES_CAJA_VENTAS_TEMP_DIR ||
  path.join(os.tmpdir(), "rve-reportes-caja-ventas");

const prepareUploadFolders = (req, _res, next) => {
  const id = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}`;
  req.reportesCajaVentasTempRoot = path.join(uploadRoot, id);
  req.reportesCajaDir = path.join(req.reportesCajaVentasTempRoot, "reportes-caja");
  req.ventasTvDir = path.join(req.reportesCajaVentasTempRoot, "ventas-tv");
  req.ventasCelularDir = path.join(
    req.reportesCajaVentasTempRoot,
    "ventas-celular",
  );

  [req.reportesCajaDir, req.ventasTvDir, req.ventasCelularDir].forEach(
    (directorio) => fs.mkdirSync(directorio, { recursive: true }),
  );
  next();
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (req.reportesCajaApiTipo === "CELULAR") {
      return cb(null, req.ventasCelularDir);
    }
    if (req.reportesCajaApiTipo === "TV") {
      return cb(null, req.ventasTvDir);
    }

    const directorios = {
      reportesCaja: req.reportesCajaDir,
      ventasTv: req.ventasTvDir,
      ventasCelular: req.ventasCelularDir,
    };
    return cb(
      null,
      directorios[file.fieldname] || req.reportesCajaVentasTempRoot,
    );
  },
  filename: (_req, file, cb) => {
    const original = path
      .basename(file.originalname)
      .replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}-${crypto.randomBytes(4).toString("hex")}-${original}`);
  },
});

const fileFilterPdf = (_req, file, cb) => {
  const isPdf =
    file.mimetype === "application/pdf" ||
    path.extname(file.originalname).toLowerCase() === ".pdf";

  if (!isPdf) {
    return cb(new Error("Solo se permiten archivos PDF"));
  }

  return cb(null, true);
};

const upload = multer({
  storage,
  limits: { files: 150, fileSize: 25 * 1024 * 1024 },
  fileFilter: fileFilterPdf,
});

const uploadApi = multer({
  storage,
  limits: { files: 50, fileSize: 25 * 1024 * 1024 },
  fileFilter: fileFilterPdf,
});

const responderErrorCarga = async (req, res, error) => {
  if (req.reportesCajaVentasTempRoot) {
    await fsp
      .rm(req.reportesCajaVentasTempRoot, { recursive: true, force: true })
      .catch(() => {});
  }

  const message =
    error.code === "LIMIT_FILE_SIZE"
      ? "Cada PDF debe pesar como maximo 25 MB"
      : error.code === "LIMIT_FILE_COUNT"
        ? "No se permiten mas de 50 PDFs por solicitud"
        : error.message || "No se pudieron subir los PDFs";

  return res.status(400).json({
    ok: false,
    code: "ARCHIVO_INVALIDO",
    message,
  });
};

const uploadPdfs = (req, res, next) => {
  upload.fields([
    { name: "reportesCaja", maxCount: 50 },
    { name: "ventasTv", maxCount: 50 },
    { name: "ventasCelular", maxCount: 50 },
  ])(req, res, async (error) => {
    if (!error) return next();
    return responderErrorCarga(req, res, error);
  });
};

const asignarRequestId = (req, res, next) => {
  req.reportesCajaRequestId = crypto.randomUUID();
  res.setHeader("X-Request-Id", req.reportesCajaRequestId);
  next();
};

const asignarTipoApi = (tipo) => (req, _res, next) => {
  req.reportesCajaApiTipo = tipo;
  next();
};

const cargarPdfsApi = (req, res, next) => {
  uploadApi.fields([
    { name: "archivo", maxCount: 50 },
    { name: "archivos", maxCount: 50 },
  ])(req, res, async (error) => {
    if (error) return responderErrorCarga(req, res, error);

    const archivos = [
      ...(req.files?.archivo || []),
      ...(req.files?.archivos || []),
    ];
    const campoDestino =
      req.reportesCajaApiTipo === "CELULAR" ? "ventasCelular" : "ventasTv";
    req.files = { [campoDestino]: archivos };
    return next();
  });
};

// Integraciones diarias: cada tipo usa una URL independiente y la API key de RVE.
router.post(
  "/celulares/importar",
  asignarRequestId,
  requireReportesCajaCelularesApiKey,
  asignarTipoApi("CELULAR"),
  prepareUploadFolders,
  cargarPdfsApi,
  controller.importarVentasApi,
);

router.post(
  "/televisiones/importar",
  asignarRequestId,
  requireReportesCajaTelevisionesApiKey,
  asignarTipoApi("TV"),
  prepareUploadFolders,
  cargarPdfsApi,
  controller.importarVentasApi,
);

router.post(
  "/extraer",
  authenticate,
  requireContabilidad,
  prepareUploadFolders,
  uploadPdfs,
  controller.extraerCierreCajaConVentas,
);

module.exports = router;
