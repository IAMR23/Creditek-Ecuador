const crypto = require("crypto");
const fs = require("fs");
const fsp = require("fs/promises");
const os = require("os");
const path = require("path");
const express = require("express");
const multer = require("multer");

const { authenticate, requirePermission } = require("../../middleware/authMiddleware");
const {
  extraerReportesCaja,
} = require("../../controllers/Contabilidad/reportesCajaController");

const router = express.Router();
const requireContabilidad = requirePermission("Contabilidad", "Administracion");

const uploadRoot =
  process.env.REPORTES_CAJA_TEMP_DIR ||
  path.join(os.tmpdir(), "rve-reportes-caja");

const prepareUploadFolder = (req, _res, next) => {
  const id = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}`;
  req.reportesCajaTempRoot = path.join(uploadRoot, id);
  req.reportesCajaInputDir = path.join(req.reportesCajaTempRoot, "pdfs");

  fs.mkdirSync(req.reportesCajaInputDir, { recursive: true });
  next();
};

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    cb(null, req.reportesCajaInputDir);
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
    files: 50,
    fileSize: 25 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const isPdf =
      file.mimetype === "application/pdf" ||
      path.extname(file.originalname).toLowerCase() === ".pdf";

    if (!isPdf) {
      return cb(new Error("Solo se permiten archivos PDF"));
    }

    cb(null, true);
  },
});

const uploadPdfs = (req, res, next) => {
  upload.array("pdfs", 50)(req, res, async (error) => {
    if (!error) return next();

    if (req.reportesCajaTempRoot) {
      await fsp.rm(req.reportesCajaTempRoot, { recursive: true, force: true }).catch(
        () => {},
      );
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
  prepareUploadFolder,
  uploadPdfs,
  extraerReportesCaja,
);

module.exports = router;
