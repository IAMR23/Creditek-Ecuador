const express = require("express");
const bcrypt = require("bcryptjs");
const Usuario = require("../models/Usuario");
const Rol = require("../models/Rol");

const router = express.Router();

const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).{6,}$/;

router.post("/", async (req, res) => {
  try {
    const {
      nombre,
      cedula,
      email,
      password,
      rolId,
      fechaIngreso,
      fechaSalida,
      numeroCuenta,
      direccion,
      telefono,
    } = req.body;

    if (!passwordRegex.test(password || "")) {
      return res.status(400).json({
        message: "La contraseña debe tener mínimo 6 caracteres e incluir letras y números.",
      });
    }

    const existing = await Usuario.findOne({ where: { email } });
    if (existing) return res.status(400).json({ message: "El email ya está registrado." });

    if (!rolId) {
      return res.status(400).json({ message: "El campo rolId es obligatorio." });
    }
    const existeRol = await Rol.findByPk(rolId);
    if (!existeRol) {
      return res.status(400).json({ message: "El rol especificado no existe." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const nuevoUsuario = await Usuario.create({
      nombre,
      cedula,
      email,
      password: hashedPassword,
      rolId,
      fechaIngreso,
      fechaSalida,
      numeroCuenta,
      direccion,
      telefono,
      activo: true,
    });

    const { password: _pw, ...usuarioSinPassword } = nuevoUsuario.toJSON();
    return res.status(201).json(usuarioSinPassword);
  } catch (error) {
    return res.status(500).json({ message: "Error al crear el usuario", error });
  }
});

router.get("/", async (_req, res) => {
  try {
    const usuarios = await Usuario.findAll({
      attributes: { exclude: ["password"] },
      include: [{ model: Rol, as: "rol", attributes: ["id", "nombre"] }],
      order: [["nombre", "ASC"]],
    });
    return res.json(usuarios);
  } catch (error) {
    return res.status(500).json({ message: "Error al obtener usuarios", error });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const usuario = await Usuario.findByPk(req.params.id, {
      attributes: { exclude: ["password"] },
      include: [{ model: Rol, as: "rol", attributes: ["id", "nombre"] }],
    });
    if (!usuario) return res.status(404).json({ message: "Usuario no encontrado" });
    return res.json(usuario);
  } catch (error) {
    return res.status(500).json({ message: "Error al obtener usuario", error });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const usuario = await Usuario.findByPk(req.params.id);
    if (!usuario) return res.status(404).json({ message: "Usuario no encontrado" });

    const {
      nombre,
      cedula,
      email,
      password,
      rolId,
      activo,
      fechaIngreso,
      fechaSalida,
      numeroCuenta,
      direccion,
      telefono,
    } = req.body;

    if (email && email !== usuario.email) {
      const existeEmail = await Usuario.findOne({ where: { email } });
      if (existeEmail) return res.status(400).json({ message: "El email ya está en uso." });
      usuario.email = email;
    }

    if (password) {
      if (!passwordRegex.test(password)) {
        return res.status(400).json({
          message: "La contraseña debe tener mínimo 6 caracteres e incluir letras y números.",
        });
      }
      usuario.password = await bcrypt.hash(password, 10);
    }

    if (rolId !== undefined) {
      const existeRol = await Rol.findByPk(rolId);
      if (!existeRol) {
        return res.status(400).json({ message: "El rol especificado no existe." });
      }
      usuario.rolId = rolId;
    }
    if (nombre !== undefined) usuario.nombre = nombre;
    if (cedula !== undefined) usuario.cedula = cedula;
    if (activo !== undefined) usuario.activo = activo;
    if (fechaIngreso !== undefined) usuario.fechaIngreso = fechaIngreso;
    if (fechaSalida !== undefined) usuario.fechaSalida = fechaSalida;
    if (numeroCuenta !== undefined) usuario.numeroCuenta = numeroCuenta;
    if (direccion !== undefined) usuario.direccion = direccion;
    if (telefono !== undefined) usuario.telefono = telefono;

    await usuario.save();
    const { password: _pw, ...usuarioSinPassword } = usuario.toJSON();
    return res.json(usuarioSinPassword);
  } catch (error) {
    return res.status(500).json({ message: "Error al actualizar usuario", error });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const usuario = await Usuario.findByPk(req.params.id);
    if (!usuario) return res.status(404).json({ message: "Usuario no encontrado" });
    await usuario.destroy();
    return res.json({ message: "Usuario eliminado correctamente" });
  } catch (error) {
    return res.status(500).json({ message: "Error al eliminar usuario", error });
  }
});

module.exports = router;
