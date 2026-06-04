const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "apolo_secret";

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
