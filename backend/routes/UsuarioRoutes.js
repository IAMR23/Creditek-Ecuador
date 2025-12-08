const express = require("express");
const router = express.Router();
const Usuario = require("../models/Usuario");
const Rol = require("../models/Rol");
const bcrypt = require("bcryptjs");

const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).{6,}$/;

// ===========================
// 🔹 CREAR USUARIO
// ===========================
router.post("/", async (req, res) => {
  try {
    const { nombre, cedula, email, password, rolId } = req.body;

    // Validar contraseña
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        message:
          "La contraseña debe tener mínimo 8 caracteres, con mayúsculas, minúsculas, números y un carácter especial.",
      });
    }

    // Email duplicado
    const existing = await Usuario.findOne({ where: { email } });
    if (existing) {
      return res.status(400).json({ message: "El email ya está registrado." });
    }

    // Validar rolId
    if (!rolId) {
      return res.status(400).json({ message: "El campo rolId es obligatorio." });
    }

    const existeRol = await Rol.findByPk(rolId);
    if (!existeRol) {
      return res.status(400).json({ message: "El rol especificado no existe." });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const nuevoUsuario = await Usuario.create({
      nombre,
      cedula,
      email,
      password: hashedPassword,
      rolId,
      activo: true,
    });

    const { password: _, ...usuarioSinPassword } = nuevoUsuario.toJSON();
    res.status(201).json(usuarioSinPassword);
  } catch (error) {
    console.error("Error creando usuario:", error);
    res.status(500).json({ message: "Error al crear el usuario", error });
  }
});

// ===========================
// 🔹 OBTENER TODOS
// ===========================
router.get("/", async (req, res) => {
  try {
    const usuarios = await Usuario.findAll({
      attributes: { exclude: ["password"] },
      include: [{ model: Rol , as: "rol", attributes: ["id", "nombre"] }],
    });
    res.json(usuarios);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener usuarios", error });
  }
});

// ===========================
// 🔹 OBTENER POR ID
// ===========================
router.get("/:id", async (req, res) => {
  try {
    const usuario = await Usuario.findByPk(req.params.id, {
      attributes: { exclude: ["password"] },
      include: [{ model: Rol, attributes: ["id", "nombre"] }],
    });

    if (!usuario) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    res.json(usuario);
  } catch (error) {
    res.status(500).json({ message: "Error al obtener usuario", error });
  }
});

// ===========================
// 🔹 ACTUALIZAR
// ===========================
router.put("/:id", async (req, res) => {
  try {
    const { nombre, cedula, email, password, rolId, activo } = req.body;
    const usuario = await Usuario.findByPk(req.params.id);

    if (!usuario) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    // ========== VALIDAR EMAIL SOLO SI CAMBIA ==========
    if (email && email !== usuario.email) {
      const existeEmail = await Usuario.findOne({ where: { email } });
      if (existeEmail) {
        return res.status(400).json({ message: "El email ya está en uso." });
      }
      usuario.email = email;
    }

    // ========== VALIDAR PASSWORD SOLO SI LO ENVIAN ==========
    if (password) {
      if (!passwordRegex.test(password)) {
        return res.status(400).json({
          message:
            "La contraseña debe tener mínimo 8 caracteres, con mayúsculas, minúsculas, números, y un carácter especial.",
        });
      }
      usuario.password = await bcrypt.hash(password, 10);
    }

    // ========== VALIDAR Y ACTUALIZAR ROL SOLO SI LO ENVÍAN ==========
    if (rolId !== undefined) {
      const existeRol = await Rol.findByPk(rolId);
      if (!existeRol) {
        return res.status(400).json({ message: "El rol especificado no existe." });
      }
      usuario.rolId = rolId;
    }

    // ========== CAMPOS NORMALES (solo si vienen) ==========
    if (nombre !== undefined) usuario.nombre = nombre;
    if (cedula !== undefined) usuario.cedula = cedula;
    if (activo !== undefined) usuario.activo = activo;

    await usuario.save();

    const { password: _, ...usuarioSinPassword } = usuario.toJSON();
    res.json(usuarioSinPassword);
  } catch (error) {
    res.status(500).json({ message: "Error al actualizar usuario", error });
  }
});

// ===========================
// 🔹 ELIMINAR
// ===========================
router.delete("/:id", async (req, res) => {
  try {
    const usuario = await Usuario.findByPk(req.params.id);

    if (!usuario) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    await usuario.destroy();
    res.json({ message: "Usuario eliminado correctamente" });
  } catch (error) {
    res.status(500).json({ message: "Error al eliminar usuario", error });
  }
});

module.exports = router;
