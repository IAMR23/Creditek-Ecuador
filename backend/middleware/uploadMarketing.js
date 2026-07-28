const fs = require("fs");
const path = require("path");
const multer = require("multer");

const uploadsMarketingDir = path.resolve(__dirname, "../uploads/marketing");
fs.mkdirSync(uploadsMarketingDir, { recursive: true });

const extensionesPorMime = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsMarketingDir),
  filename: (_req, file, cb) => {
    const extension = extensionesPorMime[file.mimetype];
    const nombre = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`;
    cb(null, nombre);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    if (!extensionesPorMime[file.mimetype]) {
      return cb(
        new Error("La imagen debe estar en formato JPG, PNG o WEBP"),
      );
    }

    return cb(null, true);
  },
});

const procesarImagenMarketing = (req, res, next) => {
  upload.single("imagen")(req, res, (error) => {
    if (!error) return next();

    const message =
      error.code === "LIMIT_FILE_SIZE"
        ? "La imagen no puede superar los 5 MB"
        : error.message || "No se pudo procesar la imagen";

    return res.status(400).json({ ok: false, message });
  });
};

module.exports = {
  procesarImagenMarketing,
  uploadsMarketingDir,
};
