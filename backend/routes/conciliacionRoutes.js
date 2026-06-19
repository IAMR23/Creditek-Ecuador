const crypto = require("crypto");
const fs = require("fs");
const fsp = require("fs/promises");
const os = require("os");
const path = require("path");
const express = require("express");
const multer = require("multer");

const { authenticate } = require("../middleware/authMiddleware");
const {
  actualizarMapeoModeloCelular,
  actualizarMapeoModeloTv,
  actualizarModeloImportacionTv,
  extraerModelosCelularDesdePdf,
  extraerModelosTvDesdePdf,
  importarPdf,
  listarModelosCelular,
  listarModelosCelularExtraidos,
  listarModelosTvExtraidos,
  listarModelosTv,
} = require("../controllers/conciliacionController");

const router = express.Router();
const uploadRoot =
  process.env.CONCILIACION_TEMP_DIR ||
  path.join(os.tmpdir(), "rve-conciliacion-pdf");

const prepareUploadFolder = (req, res, next) => {
  const id = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}`;
  req.conciliacionTempRoot = path.join(uploadRoot, id);
  req.conciliacionInputDir = path.join(req.conciliacionTempRoot, "pdfs");

  fs.mkdirSync(req.conciliacionInputDir, { recursive: true });
  next();
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, req.conciliacionInputDir);
  },
  filename: (req, file, cb) => {
    const original = path
      .basename(file.originalname)
      .replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}-${crypto.randomBytes(4).toString("hex")}-${original}`);
  },
});

const upload = multer({
  storage,
  limits: {
    files: 30,
    fileSize: 25 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
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
  upload.array("pdfs", 30)(req, res, async (error) => {
    if (!error) return next();

    if (req.conciliacionTempRoot) {
      await fsp.rm(req.conciliacionTempRoot, { recursive: true, force: true }).catch(
        () => {},
      );
    }

    return res.status(400).json({
      ok: false,
      message: error.message || "No se pudieron subir los PDFs",
    });
  });
};

router.get("/modelos-tv", authenticate, listarModelosTv);
router.get("/modelos-tv-extraidos", authenticate, listarModelosTvExtraidos);
router.patch(
  "/modelos-tv-extraidos/:id",
  authenticate,
  actualizarMapeoModeloTv,
);
router.post(
  "/modelos-tv/extraer-pdf",
  authenticate,
  prepareUploadFolder,
  uploadPdfs,
  extraerModelosTvDesdePdf,
);
router.get("/modelos-celular", authenticate, listarModelosCelular);
router.get(
  "/modelos-celular-extraidos",
  authenticate,
  listarModelosCelularExtraidos,
);
router.patch(
  "/modelos-celular-extraidos/:id",
  authenticate,
  actualizarMapeoModeloCelular,
);
router.post(
  "/modelos-celular/extraer-pdf",
  authenticate,
  prepareUploadFolder,
  uploadPdfs,
  extraerModelosCelularDesdePdf,
);
router.patch(
  "/importaciones/:id/modelo-tv",
  authenticate,
  actualizarModeloImportacionTv,
);
router.post("/importar-pdf", authenticate, prepareUploadFolder, uploadPdfs, importarPdf);

module.exports = router;
