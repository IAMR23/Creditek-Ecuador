const jwt = require("jsonwebtoken");
const Usuario = require("../models/Usuario");


const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "No token" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = {
      id: decoded.usuario.id,
      agenciaId: decoded.usuario.agenciaPrincipal?.agenciaId
    };

    if (!req.user.agenciaId) {
      return res.status(400).json({ message: "Usuario sin agencia asignada" });
    }

    next();
  } catch (error) {
    return res.status(401).json({ message: "Token inválido" });
  }
};



module.exports = { authenticate };
