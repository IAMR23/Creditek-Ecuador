const isProduction = process.env.NODE_ENV === "production";

const getSecret = (name, developmentFallback) => {
  const value = process.env[name];
  if (value) return value;

  if (isProduction) {
    throw new Error(`${name} es obligatorio en produccion.`);
  }

  return developmentFallback;
};

const durationToMs = (duration, fallbackMs = 7 * 24 * 60 * 60 * 1000) => {
  const match = String(duration || "").match(/^(\d+)([smhd])$/);
  if (!match) return fallbackMs;

  const value = Number(match[1]);
  const unit = match[2];
  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
  };

  return value * multipliers[unit];
};

const JWT_SECRET = getSecret("JWT_SECRET", "rve_dev_access_secret");
const JWT_REFRESH_SECRET = getSecret(
  "JWT_REFRESH_SECRET",
  "rve_dev_refresh_secret",
);
const JWT_ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || "15m";
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || "7d";
const REFRESH_COOKIE_NAME = "rve_refresh_token";

const getRefreshCookieOptions = () => ({
  httpOnly: true,
  secure:
    process.env.REFRESH_TOKEN_COOKIE_SECURE === "true" ||
    process.env.NODE_ENV === "production",
  sameSite: (process.env.REFRESH_TOKEN_COOKIE_SAMESITE || "lax").toLowerCase(),
  path: "/auth",
  maxAge: durationToMs(JWT_REFRESH_EXPIRES_IN),
});

const getClearRefreshCookieOptions = () => {
  const { maxAge, ...options } = getRefreshCookieOptions();
  return options;
};

module.exports = {
  JWT_SECRET,
  JWT_REFRESH_SECRET,
  JWT_ACCESS_EXPIRES_IN,
  JWT_REFRESH_EXPIRES_IN,
  REFRESH_COOKIE_NAME,
  durationToMs,
  getRefreshCookieOptions,
  getClearRefreshCookieOptions,
};
