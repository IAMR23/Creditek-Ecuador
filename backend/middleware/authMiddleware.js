const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Middleware para verificar que el usuario está autenticado
const authenticate = async (req, res, next) => {
  try {
    // Obtener el token del encabezado Authorization (Bearer <token>)
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "No se proporcionó token" });
    }

    // Verificar y decodificar el token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Buscar el usuario en la base de datos
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ message: "Usuario no encontrado" });
    }

    // Asignar el usuario a la solicitud para su uso en los controladores
    req.user = user;

    // Continuar al siguiente middleware o controlador
    next();
  } catch (error) {
    res.status(401).json({ message: "Token inválido o expirado", error });
  }
};

// Middleware para verificar que el usuario sea un arrendador (cantante)
const isPlayer = (req, res, next) => {
  if (req.user && req.user.rol === "cantante") {
    return next(); // El usuario es cantante, continuar
  }
  return res
    .status(403)
    .json({ message: "Acción solo permitida para cantantes" });
};

const isAprobado = (req, res, next) => {
  if (req.user && req.user.verificado === true) {
    return next(); // El cantante está aprobado, continuar
  }
  return res.status(403).json({
    message: "El cantante no está aprobado para realizar esta acción",
  });
};

const isAdmin = (req, res, next) => {
  if (req.user && req.user.rol === "admin") {
    return next(); // El usuario es admin, continuar
  }
  return res
    .status(403)
    .json({ message: "Acción solo permitida para administradores" });
};

const verificarSuscripcionActiva = async (req, res, next) => {
  try {
    const usuario = req.user; // usuario autenticado

    // Si es admin, saltar validación de suscripción
    if (usuario.rol === "admin") {
      return next();
    }

    const ahora = new Date();
    const fin = new Date(usuario.subscriptionEnd);

    if (!usuario.suscrito || ahora > fin) {
      return res.status(403).json({ mensaje: "Tu suscripción ha expirado" });
    }

    next(); // usuario suscrito y activo
  } catch (err) {
    console.error("Error en middleware de suscripción:", err);
    res.status(500).json({ mensaje: "Error del servidor" });
  }
};

module.exports = {
  authenticate,
  isPlayer,
  isAprobado,
  isAdmin,
  verificarSuscripcionActiva,
};
