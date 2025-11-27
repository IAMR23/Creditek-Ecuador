const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const Usuario = require("../models/Usuario");
const UsuarioAgencia = require("../models/UsuarioAgencia");
const Agencia = require("../models/Agencia");

const JWT_SECRET = process.env.JWT_SECRET || "tu_clave_secreta";

// ===========================
// 🔹 LOGIN
// ===========================
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Buscar usuario
    const usuario = await Usuario.findOne({ where: { email } });
    if (!usuario) {
      return res.status(400).json({ message: "Usuario o contraseña incorrectos" });
    }

    if (!usuario.activo) {
      return res.status(403).json({ message: "Usuario no activo" });
    }

    // Verificar contraseña
    const isMatch = await bcrypt.compare(password, usuario.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Usuario o contraseña incorrectos" });
    }

    // Relaciones usuario-agencia
    const relaciones = await UsuarioAgencia.findAll({
      where: { usuarioId: usuario.id, activo: true },
      include: [
        {
          model: Agencia,
          as: "agencia",
          attributes: ["id", "nombre", "direccion", "telefono", "ciudad"],
        },
      ],
    });

    if (relaciones.length === 0) {
      return res.status(400).json({ message: "El usuario no tiene agencias activas" });
    }

    // Mapear agencias + guardar ID de la tabla UsuarioAgencia
    const agencias = relaciones.map((rel) => ({
      usuarioAgenciaId: rel.id,      // ← IMPORTANTE
      agenciaId: rel.agencia.id,
      nombre: rel.agencia.nombre,
      direccion: rel.agencia.direccion,
      telefono: rel.agencia.telefono,
      ciudad: rel.agencia.ciudad,
      rolAgencia: rel.rolAgencia,
    }));

    // Tomar la primera agencia por defecto
    const agenciaPrincipal = agencias[0];

    // Crear token con más info
    const token = jwt.sign(
      {
        id: usuario.id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
        usuarioAgenciaId: agenciaPrincipal.usuarioAgenciaId,
        

      },
      JWT_SECRET,
      { expiresIn: "8h" }
    );

    res.json({
      message: "Login exitoso",
      token
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error en el login", error });
  }
});


module.exports = router;
