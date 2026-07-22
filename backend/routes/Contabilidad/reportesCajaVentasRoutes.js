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
  extraerCierreCajaConVentas,
} = require("../../controllers/Contabilidad/reportesCajaVentasController");

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
    const directorios = {
      reportesCaja: req.reportesCajaDir,
      ventasTv: req.ventasTvDir,
      ventasCelular: req.ventasCelularDir,
    };
    cb(null, directorios[file.fieldname] || req.reportesCajaVentasTempRoot);
  },
  filename: (_req, file, cb) => {
    const original = path
      .basename(file.originalname)
      .replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}-${crypto.randomBytes(4).toString("hex")}-${original}`);
  },
});

const upload = multer({
  storage,
  limits: {
    files: 150,
    fileSize: 25 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const isPdf =
      file.mimetype === "application/pdf" ||
      path.extname(file.originalname).toLowerCase() === ".pdf";

    if (!isPdf) {
      return cb(new Error("Solo se permiten archivos PDF"));
    }

    return cb(null, true);
  },
});

const uploadPdfs = (req, res, next) => {
  upload.fields([
    { name: "reportesCaja", maxCount: 50 },
    { name: "ventasTv", maxCount: 50 },
    { name: "ventasCelular", maxCount: 50 },
  ])(req, res, async (error) => {
    if (!error) return next();

    if (req.reportesCajaVentasTempRoot) {
      await fsp
        .rm(req.reportesCajaVentasTempRoot, { recursive: true, force: true })
        .catch(() => {});
    }

    return res.status(400).json({
      ok: false,
      message: error.message || "No se pudieron subir los PDFs",
    });
  });
};

router.post(
  "/extraer",
  authenticate,
  requireContabilidad,
  prepareUploadFolders,
  uploadPdfs,
  extraerCierreCajaConVentas,
);

module.exports = router;
