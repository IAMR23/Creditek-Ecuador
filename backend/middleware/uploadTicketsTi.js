const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

// Se conserva fuera de /uploads porque esa carpeta se publica como estática.
// Los archivos de tickets sólo se sirven por el endpoint autenticado.
const uploadsTicketsDir = path.resolve(__dirname, "../private-uploads/tickets-ti");
fs.mkdirSync(uploadsTicketsDir, { recursive: true });

const tiposPermitidos = new Map([
  ["application/pdf", [".pdf"]],
  ["image/jpeg", [".jpg", ".jpeg"]],
  ["image/png", [".png"]],
  ["image/webp", [".webp"]],
  ["text/plain", [".txt"]],
  ["text/csv", [".csv"]],
  ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", [".xlsx"]],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", [".docx"]],
]);

const limpiarNombreOriginal = (value) => {
  const base = path.basename(String(value || "archivo"));
  return base
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[\\/:*?"<>|]/g, "-")
    .trim()
    .slice(0, 240) || "archivo";
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsTicketsDir),
  filename: (_req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    cb(null, `${crypto.randomUUID()}${extension}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const extensiones = tiposPermitidos.get(file.mimetype);
    if (!extensiones || !extensiones.includes(extension)) {
      return cb(new Error("Tipo de archivo no permitido"));
    }
    file.originalname = limpiarNombreOriginal(file.originalname);
    return cb(null, true);
  },
});

const procesarArchivosTickets = (req, res, next) => {
  upload.array("archivos", 5)(req, res, (error) => {
    if (!error) return next();
    const message =
      error.code === "LIMIT_FILE_SIZE"
        ? "Cada archivo puede pesar como máximo 10 MB"
        : error.code === "LIMIT_FILE_COUNT"
          ? "Puede adjuntar como máximo 5 archivos por operación"
          : error.message || "No se pudieron procesar los archivos";
    Promise.all(
      (req.files || []).map((file) => fs.promises.unlink(file.path).catch(() => {})),
    ).finally(() => res.status(400).json({ ok: false, message }));
  });
};

module.exports = {
  limpiarNombreOriginal,
  procesarArchivosTickets,
  uploadsTicketsDir,
};
