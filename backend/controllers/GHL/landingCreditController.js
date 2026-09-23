const crypto = require("crypto");
const {
  submitLandingCreditApplication,
} = require("../../services/landingCreditGhlService");

const IDEMPOTENCY_TTL_MS = 10 * 60 * 1000;
const MAX_IDEMPOTENCY_ENTRIES = 10000;
const idempotencyEntries = new Map();

const fingerprint = (body) => crypto
  .createHash("sha256")
  .update(JSON.stringify({
    fullName: body?.fullName,
    cedula: body?.cedula,
    phone: body?.phone,
    province: body?.province,
    productType: body?.productType,
  }))
  .digest("hex");

const pruneIdempotencyEntries = (now = Date.now()) => {
  for (const [key, entry] of idempotencyEntries) {
    if (entry.expiresAt <= now) idempotencyEntries.delete(key);
  }
};

const getIdempotencyKey = (req) => {
  const key = String(req.get("Idempotency-Key") || "").trim();
  return /^[A-Za-z0-9_-]{16,100}$/.test(key) ? key : null;
};

const runIdempotently = async (key, body, operation) => {
  pruneIdempotencyEntries();
  const requestFingerprint = fingerprint(body);
  const existing = idempotencyEntries.get(key);

  if (existing) {
    if (existing.fingerprint !== requestFingerprint) {
      const error = new Error("La clave de idempotencia ya fue utilizada");
      error.code = "IDEMPOTENCY_KEY_REUSED";
      error.statusCode = 409;
      throw error;
    }
    return existing.promise;
  }

  const promise = Promise.resolve().then(operation);
  idempotencyEntries.set(key, {
    fingerprint: requestFingerprint,
    promise,
    expiresAt: Date.now() + IDEMPOTENCY_TTL_MS,
  });
  while (idempotencyEntries.size > MAX_IDEMPOTENCY_ENTRIES) {
    idempotencyEntries.delete(idempotencyEntries.keys().next().value);
  }

  try {
    return await promise;
  } catch (error) {
    idempotencyEntries.delete(key);
    throw error;
  }
};

const createLandingCreditApplication = async (req, res) => {
  res.set("Cache-Control", "no-store");
  const idempotencyKey = getIdempotencyKey(req);
  if (!idempotencyKey) {
    return res.status(400).json({
      ok: false,
      code: "IDEMPOTENCY_KEY_REQUIRED",
      message: "No se pudo identificar este envío. Recarga la página e intenta nuevamente.",
    });
  }

  try {
    const result = await runIdempotently(
      idempotencyKey,
      req.body,
      () => submitLandingCreditApplication(req.body),
    );
    return res.status(result.created ? 201 : 200).json({
      ok: true,
      message: "Tu solicitud fue enviada correctamente.",
    });
  } catch (error) {
    const errorStatus = Number(error?.statusCode) || 500;
    const status = [409, 422].includes(errorStatus)
      ? errorStatus
      : errorStatus === 503
        ? 503
        : 502;
    if (status >= 500) {
      console.error("Error enviando solicitud de crédito de landing a GHL.", {
        code: error?.code || "UNKNOWN_ERROR",
        status,
      });
    }
    return res.status(status).json({
      ok: false,
      code: error?.code || "LANDING_CREDIT_SUBMISSION_ERROR",
      message: status === 422
        ? "Revisa los datos ingresados e intenta nuevamente."
        : status === 409
          ? "El formulario cambió durante el envío. Intenta nuevamente."
          : "No pudimos enviar tu solicitud en este momento. Intenta nuevamente.",
      ...(status === 422 ? { errors: error.validationErrors || {} } : {}),
    });
  }
};

const resetIdempotencyForTests = () => idempotencyEntries.clear();

module.exports = {
  createLandingCreditApplication,
  resetIdempotencyForTests,
  runIdempotently,
};
