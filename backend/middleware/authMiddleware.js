const jwt = require("jsonwebtoken");
const UsuarioAgencia = require("../models/UsuarioAgencia");
const { JWT_SECRET } = require("../utils/tokenConfig");

const normalize = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const authenticate = async (req, res, next) => {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({
        code: "TOKEN_MISSING",
        message: "No token",
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    const agenciaPrincipal = decoded.usuario.agenciaPrincipal || {};
    const agencias = Array.isArray(decoded.usuario.agencias)
      ? decoded.usuario.agencias
      : [];
    let agenciaId =
      agenciaPrincipal.agenciaId ||
      agenciaPrincipal.id ||
      agencias[0]?.agenciaId ||
      agencias[0]?.id;
    let usuarioAgenciaId =
      agenciaPrincipal.usuarioAgenciaId ||
      agenciaPrincipal.idUsuarioAgencia ||
      agencias.find((agencia) => String(agencia.agenciaId) === String(agenciaId))
        ?.usuarioAgenciaId ||
      agencias[0]?.usuarioAgenciaId;

    if (usuarioAgenciaId && !agenciaId) {
      const relacion = await UsuarioAgencia.findOne({
        where: {
          id: usuarioAgenciaId,
          activo: true,
        },
        attributes: ["id", "agenciaId"],
      });

      agenciaId = relacion?.agenciaId;
      usuarioAgenciaId = relacion?.id || usuarioAgenciaId;
    }

    if (!usuarioAgenciaId && agenciaId) {
      const relacion = await UsuarioAgencia.findOne({
        where: {
          usuarioId: decoded.usuario.id,
          agenciaId,
          activo: true,
        },
        attributes: ["id", "agenciaId"],
      });

      usuarioAgenciaId = relacion?.id;
      agenciaId = relacion?.agenciaId || agenciaId;
    }

    req.user = {
      id: decoded.usuario.id,
      agenciaId,
      usuarioAgenciaId,
      rol: decoded.usuario.rol?.nombre,
      permisos: decoded.usuario.permisosAsignados || [],
    };

    if (!req.user.agenciaId) {
      return res.status(400).json({ message: "Usuario sin agencia asignada" });
    }

    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        code: "TOKEN_EXPIRED",
        message: "Token expirado",
      });
    }

    return res.status(401).json({
      code: "TOKEN_INVALID",
      message: "Token invalido",
    });
  }
};

const requirePermission = (...permisosPermitidos) => (req, res, next) => {
  const rolUsuario = normalize(req.user?.rol);
  const permisosUsuario = (req.user?.permisos || []).map(normalize);
  const permisosRequeridos = permisosPermitidos.flat().map(normalize);
  const tieneAccesoBaseAdmin =
    ["admin", "administrador"].includes(rolUsuario) &&
    permisosRequeridos.includes("administracion");
  const tienePermiso = permisosRequeridos.some((permiso) =>
    permisosUsuario.includes(permiso),
  );

  if (!tieneAccesoBaseAdmin && !tienePermiso) {
    return res
      .status(403)
      .json({ message: "No tienes permisos para esta accion" });
  }

  next();
};

module.exports = { authenticate, requirePermission };
