const crypto = require("crypto");

const DEFAULT_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_LIMIT = 10;
const MAX_BUCKETS = 10000;
const requestBuckets = new Map();

const positiveInteger = (value, fallback) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const getClientFingerprint = (req) => {
  const forwarded = String(req.get("x-forwarded-for") || "").split(",")[0].trim();
  const address = req.get("cf-connecting-ip") || forwarded || req.ip || req.socket?.remoteAddress || "unknown";
  const userAgent = req.get("user-agent") || "unknown";
  return crypto.createHash("sha256").update(`${address}|${userAgent}`).digest("hex");
};

const publicLandingRateLimit = (req, res, next) => {
  const now = Date.now();
  const windowMs = positiveInteger(process.env.LANDING_CREDIT_RATE_WINDOW_MS, DEFAULT_WINDOW_MS);
  const limit = positiveInteger(process.env.LANDING_CREDIT_RATE_LIMIT, DEFAULT_LIMIT);
  const key = getClientFingerprint(req);
  let bucket = requestBuckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    requestBuckets.set(key, bucket);
  }
  bucket.count += 1;

  if (requestBuckets.size > MAX_BUCKETS) {
    for (const [bucketKey, value] of requestBuckets) {
      if (value.resetAt <= now) requestBuckets.delete(bucketKey);
    }
    while (requestBuckets.size > MAX_BUCKETS) {
      requestBuckets.delete(requestBuckets.keys().next().value);
    }
  }

  res.set("X-RateLimit-Limit", String(limit));
  res.set("X-RateLimit-Remaining", String(Math.max(0, limit - bucket.count)));
  if (bucket.count > limit) {
    res.set("Retry-After", String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))));
    return res.status(429).json({
      ok: false,
      code: "TOO_MANY_REQUESTS",
      message: "Se realizaron demasiados intentos. Espera unos minutos y vuelve a intentar.",
    });
  }

  return next();
};

const requireSmallJsonRequest = (req, res, next) => {
  const contentLength = Number(req.get("content-length") || 0);
  if (!req.is("application/json")) {
    return res.status(415).json({ ok: false, message: "El contenido debe enviarse como JSON." });
  }
  if (contentLength > 8192) {
    return res.status(413).json({ ok: false, message: "La solicitud es demasiado grande." });
  }
  return next();
};

const resetPublicLandingRateLimitForTests = () => requestBuckets.clear();

module.exports = {
  publicLandingRateLimit,
  requireSmallJsonRequest,
  resetPublicLandingRateLimitForTests,
};
