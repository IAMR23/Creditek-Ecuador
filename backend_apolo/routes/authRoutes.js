const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const Usuario = require("../models/Usuario");
const Rol = require("../models/Rol");
const UsuarioAgencia = require("../models/UsuarioAgencia");
const Agencia = require("../models/Agencia");

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "apolo_secret";
const JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || `${JWT_SECRET}_refresh`;
const ACCESS_TOKEN_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || "15m";
const REFRESH_TOKEN_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || "7d";
const REFRESH_COOKIE_NAME = "apolo_refresh_token";

const durationToMs = (duration) => {
  const match = String(duration).match(/^(\d+)([smhd])$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000;

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

const getRefreshCookieOptions = () => ({
  httpOnly: true,
  secure:
    process.env.REFRESH_TOKEN_COOKIE_SECURE === "true" ||
    process.env.NODE_ENV === "production",
  sameSite: process.env.REFRESH_TOKEN_COOKIE_SAMESITE || "lax",
  path: "/auth",
  maxAge: durationToMs(REFRESH_TOKEN_EXPIRES_IN),
});

const getClearRefreshCookieOptions = () => {
  const { maxAge, ...options } = getRefreshCookieOptions();
  return options;
};

const getRefreshTokenFromRequest = (req) => {
  return req.cookies?.[REFRESH_COOKIE_NAME] || req.body?.refreshToken || null;
};

const getUserSessionPayload = async (usuarioId) => {
  const usuario = await Usuario.findByPk(usuarioId, {
    include: [{ model: Rol, as: "rol", attributes: ["id", "nombre", "descripcion"] }],
  });

  if (!usuario || !usuario.activo) {
    const error = new Error("Usuario no autorizado");
    error.statusCode = 403;
    throw error;
  }

  const relaciones = await UsuarioAgencia.findAll({
    where: { usuarioId: usuario.id, activo: true },
    include: [{ model: Agencia, as: "agencia", attributes: ["id", "nombre", "direccion", "telefono", "ciudad"] }],
  });

  if (relaciones.length === 0) {
    const error = new Error("El usuario no tiene agencias activas");
    error.statusCode = 403;
    throw error;
  }

  const agencias = relaciones.map((rel) => ({
    usuarioAgenciaId: rel.id,
    agenciaId: rel.agencia.id,
    nombre: rel.agencia.nombre,
    direccion: rel.agencia.direccion,
    telefono: rel.agencia.telefono,
    ciudad: rel.agencia.ciudad,
  }));

  return {
    id: usuario.id,
    nombre: usuario.nombre,
    email: usuario.email,
    rol: usuario.rol ? { id: usuario.rol.id, nombre: usuario.rol.nombre } : null,
    agencias,
    agenciaPrincipal: agencias[0],
  };
};

const signAccessToken = (usuario) => {
  return jwt.sign({ usuario }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES_IN });
};

const signRefreshToken = (usuarioId) => {
  return jwt.sign(
    { type: "refresh", usuarioId },
    JWT_REFRESH_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
  );
};

const sendSession = (res, usuario, message = "Login exitoso") => {
  const accessToken = signAccessToken(usuario);
  const refreshToken = signRefreshToken(usuario.id);

  res.cookie(REFRESH_COOKIE_NAME, refreshToken, getRefreshCookieOptions());

  return res.json({
    message,
    token: accessToken,
    accessToken,
    user: usuario,
  });
};

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const usuario = await Usuario.findOne({
      where: { email },
      include: [{ model: Rol, as: "rol", attributes: ["id", "nombre", "descripcion"] }],
    });

    if (!usuario) {
      return res.status(400).json({ message: "Usuario o contraseña incorrectos" });
    }

    if (!usuario.activo) {
      return res.status(403).json({ message: "Usuario no activo" });
    }

    const isMatch = await bcrypt.compare(password, usuario.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Usuario o contraseña incorrectos" });
    }

    const sessionUser = await getUserSessionPayload(usuario.id);

    return sendSession(res, sessionUser);
  } catch (error) {
    const status = error.statusCode || 500;
    return res.status(status).json({
      message: status === 500 ? "Error en el login" : error.message,
    });
  }
});

router.post("/refresh", async (req, res) => {
  try {
    const refreshToken = getRefreshTokenFromRequest(req);
    if (!refreshToken) {
      return res.status(401).json({
        code: "REFRESH_TOKEN_MISSING",
        message: "Sesion no renovable.",
      });
    }

    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
    if (decoded.type !== "refresh" || !decoded.usuarioId) {
      return res.status(401).json({
        code: "REFRESH_TOKEN_INVALID",
        message: "Sesion invalida.",
      });
    }

    const sessionUser = await getUserSessionPayload(decoded.usuarioId);
    return sendSession(res, sessionUser, "Token renovado");
  } catch (error) {
    res.clearCookie(REFRESH_COOKIE_NAME, getClearRefreshCookieOptions());

    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        code: "REFRESH_TOKEN_EXPIRED",
        message: "La sesion expiro. Inicia sesion nuevamente.",
      });
    }

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        code: "REFRESH_TOKEN_INVALID",
        message: "Sesion invalida.",
      });
    }

    const status = error.statusCode || 500;
    return res.status(status).json({
      code: status === 403 ? "USER_NOT_AUTHORIZED" : "REFRESH_ERROR",
      message:
        status === 403
          ? "Usuario no autorizado."
          : "No se pudo renovar la sesion.",
    });
  }
});

router.post("/logout", (_req, res) => {
  res.clearCookie(REFRESH_COOKIE_NAME, getClearRefreshCookieOptions());
  return res.json({ ok: true, message: "Sesion cerrada" });
});

module.exports = router;
