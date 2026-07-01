const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const Usuario = require("../models/Usuario");
const UsuarioAgencia = require("../models/UsuarioAgencia");
const Agencia = require("../models/Agencia");
const Rol = require("../models/Rol");
const UsuarioPermiso = require("../models/UsuarioPermiso");
const Permiso = require("../models/Permiso");
const {
  JWT_SECRET,
  JWT_REFRESH_SECRET,
  JWT_ACCESS_EXPIRES_IN,
  JWT_REFRESH_EXPIRES_IN,
  REFRESH_COOKIE_NAME,
  getRefreshCookieOptions,
  getClearRefreshCookieOptions,
} = require("../utils/tokenConfig");

const getRolesDisponibles = (usuario) =>
  usuario.roles?.length ? usuario.roles : [usuario.rol].filter(Boolean);

const seleccionarRol = (rolesDisponibles, rolId) => {
  if (!rolId) return rolesDisponibles[0];
  return rolesDisponibles.find((rol) => Number(rol.id) === Number(rolId));
};

const getUsuarioConRoles = async (where) => {
  return Usuario.findOne({
    where,
    include: [
      {
        model: Rol,
        as: "rol",
        attributes: ["id", "nombre", "descripcion"],
      },
      {
        model: Rol,
        as: "roles",
        attributes: ["id", "nombre", "descripcion"],
        through: { attributes: [] },
      },
    ],
  });
};

const getPermisosAsignados = async (usuarioId) => {
  const permisosAsignados = await UsuarioPermiso.findAll({
    where: {
      usuarioId,
      activo: true,
    },
    include: [
      {
        model: Permiso,
        as: "permiso",
        attributes: ["id", "nombre"],
      },
    ],
  });

  return permisosAsignados
    .map((p) => p.permiso?.nombre)
    .filter(Boolean);
};

const getAgenciasActivas = async (usuarioId) => {
  const relaciones = await UsuarioAgencia.findAll({
    where: {
      usuarioId,
      activo: true,
    },
    include: [
      {
        model: Agencia,
        as: "agencia",
        attributes: ["id", "nombre", "direccion", "telefono", "ciudad"],
      },
    ],
  });

  return relaciones
    .filter((rel) => rel.agencia)
    .map((rel) => ({
      usuarioAgenciaId: rel.id,
      agenciaId: rel.agencia.id,
      nombre: rel.agencia.nombre,
      direccion: rel.agencia.direccion,
      telefono: rel.agencia.telefono,
      ciudad: rel.agencia.ciudad,
      rolAgencia: rel.rolAgencia,
    }));
};

const construirUsuarioSesion = async (usuarioId, rolId) => {
  const usuario = await getUsuarioConRoles({ id: usuarioId });

  if (!usuario || !usuario.activo) {
    const error = new Error("Usuario no autorizado");
    error.statusCode = 403;
    throw error;
  }

  const rolesDisponibles = getRolesDisponibles(usuario);
  if (rolesDisponibles.length === 0) {
    const error = new Error("El usuario no tiene roles asignados");
    error.statusCode = 403;
    throw error;
  }

  const rolSeleccionado = seleccionarRol(rolesDisponibles, rolId);
  if (!rolSeleccionado) {
    const error = new Error("Rol no asignado al usuario");
    error.statusCode = 403;
    throw error;
  }

  const agencias = await getAgenciasActivas(usuario.id);
  if (agencias.length === 0) {
    const error = new Error("El usuario no tiene agencias activas");
    error.statusCode = 403;
    throw error;
  }

  const permisosAsignados = await getPermisosAsignados(usuario.id);

  return {
    id: usuario.id,
    nombre: usuario.nombre,
    email: usuario.email,
    rol: {
      id: rolSeleccionado.id,
      nombre: rolSeleccionado.nombre,
    },
    roles: rolesDisponibles.map((rol) => ({
      id: rol.id,
      nombre: rol.nombre,
    })),
    permisosAsignados,
    agencias,
    agenciaPrincipal: agencias[0],
  };
};

const signAccessToken = (usuario) =>
  jwt.sign({ usuario }, JWT_SECRET, { expiresIn: JWT_ACCESS_EXPIRES_IN });

const signRefreshToken = (usuario) =>
  jwt.sign(
    {
      type: "refresh",
      usuarioId: usuario.id,
      rolId: usuario.rol?.id,
    },
    JWT_REFRESH_SECRET,
    { expiresIn: JWT_REFRESH_EXPIRES_IN },
  );

const sendSession = (res, usuario, message = "Login exitoso") => {
  const accessToken = signAccessToken(usuario);
  const refreshToken = signRefreshToken(usuario);

  res.cookie(REFRESH_COOKIE_NAME, refreshToken, getRefreshCookieOptions());

  return res.json({
    message,
    token: accessToken,
    accessToken,
    user: usuario,
  });
};

const getRefreshTokenFromRequest = (req) =>
  req.cookies?.[REFRESH_COOKIE_NAME] || req.body?.refreshToken || null;

const clearRefreshCookie = (res) => {
  res.clearCookie(REFRESH_COOKIE_NAME, getClearRefreshCookieOptions());
};

router.post("/login", async (req, res) => {
  try {
    const { email, password, rolId } = req.body;

    const usuario = await getUsuarioConRoles({ email });

    if (!usuario) {
      return res.status(400).json({ message: "Usuario o contrasena incorrectos" });
    }

    if (!usuario.activo) {
      return res.status(403).json({ message: "Usuario no activo" });
    }

    const isMatch = await bcrypt.compare(password, usuario.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Usuario o contrasena incorrectos" });
    }

    const rolesDisponibles = getRolesDisponibles(usuario);
    if (rolesDisponibles.length === 0) {
      return res.status(403).json({ message: "El usuario no tiene roles asignados" });
    }

    if (rolesDisponibles.length > 1 && !rolId) {
      return res.json({
        requiresRoleSelection: true,
        message: "Seleccione el rol con el que desea ingresar",
        roles: rolesDisponibles.map((rol) => ({
          id: rol.id,
          nombre: rol.nombre,
          descripcion: rol.descripcion,
        })),
      });
    }

    const usuarioSesion = await construirUsuarioSesion(usuario.id, rolId);
    return sendSession(res, usuarioSesion);
  } catch (error) {
    const status = error.statusCode || 500;
    console.error("Error en login:", error.message);
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
    if (decoded.type !== "refresh" || !decoded.usuarioId || !decoded.rolId) {
      clearRefreshCookie(res);
      return res.status(401).json({
        code: "REFRESH_TOKEN_INVALID",
        message: "Sesion invalida.",
      });
    }

    const usuarioSesion = await construirUsuarioSesion(
      decoded.usuarioId,
      decoded.rolId,
    );
    return sendSession(res, usuarioSesion, "Token renovado");
  } catch (error) {
    clearRefreshCookie(res);

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
          ? error.message || "Usuario no autorizado."
          : "No se pudo renovar la sesion.",
    });
  }
});

router.post("/logout", (_req, res) => {
  clearRefreshCookie(res);
  return res.json({ ok: true, message: "Sesion cerrada" });
});

module.exports = router;
