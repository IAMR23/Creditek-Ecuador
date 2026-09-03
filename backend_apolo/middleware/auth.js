const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "apolo_secret";

const normalizeRoleName = (value) =>
  String(value || "")
    .trim()
    .toUpperCase();

module.exports = function auth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({
        code: "TOKEN_MISSING",
        message: "No autorizado: token no enviado",
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded.usuario || decoded;

    const roleName = normalizeRoleName(req.user?.rol?.nombre);
    const requestPath = String(req.originalUrl || req.url || "").split("?")[0];
    const isTestsPath =
      requestPath === "/api/pruebas" || requestPath.startsWith("/api/pruebas/");
    if (roleName === "USUARIO" && !isTestsPath) {
      return res.status(403).json({
        code: "ROLE_RESTRICTED_TO_TESTS",
        message: "Tu rol solo tiene acceso a la sección Evaluación.",
      });
    }

    return next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        code: "TOKEN_EXPIRED",
        message: "Token expirado",
      });
    }

    return res.status(401).json({
      code: "TOKEN_INVALID",
      message: "Token inválido",
    });
  }
};

module.exports.normalizeRoleName = normalizeRoleName;
