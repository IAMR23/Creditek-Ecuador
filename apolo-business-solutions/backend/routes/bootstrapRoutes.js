const express = require("express");
const bcrypt = require("bcryptjs");

const Usuario = require("../models/Usuario");
const Rol = require("../models/Rol");
const Agencia = require("../models/Agencia");
const UsuarioAgencia = require("../models/UsuarioAgencia");

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const total = await Usuario.count();
    if (total > 0) {
      return res.status(400).json({ message: "Bootstrap ya fue ejecutado." });
    }

    const { nombre, cedula, email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email y password son obligatorios." });
    }

    const rolAdmin = await Rol.findOne({ where: { nombre: "ADMIN" } });
    const agencia = await Agencia.findOne({ where: { nombre: "Matriz" } });
    if (!rolAdmin || !agencia) {
      return res.status(500).json({ message: "No existen rol ADMIN o agencia Matriz." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const usuario = await Usuario.create({
      nombre: nombre || "Admin",
      cedula: cedula || null,
      email,
      password: hashedPassword,
      rolId: rolAdmin.id,
      activo: true,
    });

    await UsuarioAgencia.create({ usuarioId: usuario.id, agenciaId: agencia.id, activo: true });

    const { password: _pw, ...usuarioSinPassword } = usuario.toJSON();
    return res.status(201).json({
      message: "Usuario admin creado. Ya puedes hacer login.",
      usuario: usuarioSinPassword,
    });
  } catch (error) {
    return res.status(500).json({ message: "Error en bootstrap", error });
  }
});

module.exports = router;

