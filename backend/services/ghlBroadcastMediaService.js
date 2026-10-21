const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");

const MAX_BROADCAST_IMAGE_BYTES = 5 * 1024 * 1024;
const BROADCAST_IMAGE_TYPES = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};
const UPLOAD_DIR = path.resolve(__dirname, "..", "uploads", "ghl-difusiones");

const createError = (message, code, statusCode = 400) => {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
};

const hasValidSignature = (buffer, mimeType) => {
  if (!Buffer.isBuffer(buffer)) return false;
  if (mimeType === "image/jpeg") return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mimeType === "image/png") {
    return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (mimeType === "image/webp") {
    return buffer.length >= 12
      && buffer.subarray(0, 4).toString("ascii") === "RIFF"
      && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  }
  return false;
};

const saveBroadcastImage = async (file) => {
  if (!file || !Buffer.isBuffer(file.buffer) || !file.size) {
    throw createError("Seleccione una imagen", "GHL_BROADCAST_IMAGE_REQUIRED");
  }
  if (file.size > MAX_BROADCAST_IMAGE_BYTES) {
    throw createError("La imagen no puede superar los 5 MB", "GHL_BROADCAST_IMAGE_TOO_LARGE");
  }
  const extension = BROADCAST_IMAGE_TYPES[file.mimetype];
  if (!extension || !hasValidSignature(file.buffer, file.mimetype)) {
    throw createError("La imagen debe ser JPG, PNG o WEBP valida", "GHL_BROADCAST_IMAGE_INVALID");
  }

  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const filename = `${crypto.randomUUID()}${extension}`;
  await fs.writeFile(path.join(UPLOAD_DIR, filename), file.buffer, { flag: "wx" });
  return {
    url: `/uploads/ghl-difusiones/${filename}`,
    nombre: path.basename(file.originalname || `imagen${extension}`).slice(0, 255),
  };
};

const normalizeStoredImageUrl = (value) => {
  const url = String(value || "").trim();
  if (!url) return null;
  if (/^\/uploads\/ghl-difusiones\/[a-f0-9-]+\.(?:jpg|png|webp)$/i.test(url)) return url;
  try {
    const parsed = new URL(url);
    if (
      parsed.protocol === "https:"
      && !parsed.username
      && !parsed.password
      && !parsed.search
      && !parsed.hash
      && /^\/uploads\/ghl-difusiones\/[a-f0-9-]+\.(?:jpg|png|webp)$/i.test(parsed.pathname)
    ) {
      return parsed.toString();
    }
  } catch {
    // Se informa el mismo error de validacion para cualquier URL no permitida.
  }
  throw createError("La imagen de difusion no es valida", "GHL_BROADCAST_IMAGE_URL_INVALID");
};

const publicImageUrl = (value, requestOrigin = "") => {
  const imageUrl = normalizeStoredImageUrl(value);
  if (!imageUrl) return null;
  if (/^https:\/\//i.test(imageUrl)) return imageUrl;

  let origin;
  try {
    origin = new URL(String(requestOrigin || "").trim()).origin;
  } catch {
    origin = "";
  }
  if (!/^https:\/\//i.test(origin)) {
    throw createError(
      "La imagen debe cargarse nuevamente desde la URL HTTPS publica del sistema",
      "GHL_BROADCAST_PUBLIC_URL_REQUIRED",
      500,
    );
  }
  return `${origin}${imageUrl}`;
};

module.exports = {
  BROADCAST_IMAGE_TYPES,
  MAX_BROADCAST_IMAGE_BYTES,
  normalizeStoredImageUrl,
  publicImageUrl,
  saveBroadcastImage,
};
