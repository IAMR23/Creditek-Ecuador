const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const Usuario = require("../models/Usuario");
const Rol = require("../models/Rol");
const UsuarioAgencia = require("../models/UsuarioAgencia");
const Agencia = require("../models/Agencia");

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "apolo_secret";

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

    const relaciones = await UsuarioAgencia.findAll({
      where: { usuarioId: usuario.id, activo: true },
      include: [{ model: Agencia, as: "agencia", attributes: ["id", "nombre", "direccion", "telefono", "ciudad"] }],
    });

    if (relaciones.length === 0) {
      return res.status(400).json({ message: "El usuario no tiene agencias activas" });
    }

    const agencias = relaciones.map((rel) => ({
      usuarioAgenciaId: rel.id,
      agenciaId: rel.agencia.id,
      nombre: rel.agencia.nombre,
      direccion: rel.agencia.direccion,
      telefono: rel.agencia.telefono,
      ciudad: rel.agencia.ciudad,
    }));

    const agenciaPrincipal = agencias[0];

    const token = jwt.sign(
      {
        usuario: {
          id: usuario.id,
          nombre: usuario.nombre,
          email: usuario.email,
          rol: usuario.rol ? { id: usuario.rol.id, nombre: usuario.rol.nombre } : null,
          agencias,
          agenciaPrincipal,
        },
      },
      JWT_SECRET,
      { expiresIn: "12h" }
    );

    return res.json({ message: "Login exitoso", token });
  } catch (error) {
    return res.status(500).json({ message: "Error en el login", error });
  }
});

module.exports = router;

