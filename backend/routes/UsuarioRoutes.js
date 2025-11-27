const express = require("express");
const router = express.Router();
const Usuario = require("../models/Usuario");
const bcrypt = require("bcryptjs");

// Regex de tu modelo
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;

// ===========================
// 🔹 CONTROLADORES CRUD
// ===========================

// Crear usuario
router.post("/", async (req, res) => {
  try {
    const { nombre, cedula, email, password, rol } = req.body;

    // Validar contraseña ANTES de hashear (para coincidir con el modelo)
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        message:
          "La contraseña debe tener mínimo 8 caracteres, incluyendo mayúsculas, minúsculas, números y un carácter especial.",
      });
    }

    // Verificar email duplicado
    const existing = await Usuario.findOne({ where: { email } });
    if (existing) {
      return res.status(400).json({ message: "El email ya está registrado." });
    }

    // Hashear contraseña
    const hashedPassword = await bcrypt.hash(password, 10);

    const nuevoUsuario = await Usuario.create({
      nombre,
      cedula,
      email,
      password: hashedPassword,
      rol: rol || "vendedor",
      activo: true,
    });

    // Nunca enviar password al frontend
    const { password: _, ...usuarioSinPassword } = nuevoUsuario.toJSON();

    res.status(201).json(usuarioSinPassword);
  } catch (error) {
    console.error("Error creando usuario:", error);
    res.status(500).json({ message: "Error al crear el usuario", error });
  }
});

// Obtener todos
router.get("/", async (req, res) => {
  try {
    const usuarios = await Usuario.findAll({
      attributes: { exclude: ["password"] },
    });
    res.json(usuarios);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener usuarios", error });
  }
});

// Obtener por ID
router.get("/:id", async (req, res) => {
  try {
    const usuario = await Usuario.findByPk(req.params.id, {
      attributes: { exclude: ["password"] },
    });

    if (!usuario) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    res.json(usuario);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener usuario", error });
  }
});

// Actualizar usuario
router.patch("/:id", async (req, res) => {
  try {
    const { nombre, cedula, email, password, rol, activo } = req.body;
    const usuario = await Usuario.findByPk(req.params.id);

    if (!usuario) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    // Evitar email duplicado
    if (email && email !== usuario.email) {
      const existeEmail = await Usuario.findOne({ where: { email } });
      if (existeEmail) {
        return res.status(400).json({ message: "Este email ya está en uso por otro usuario." });
      }
    }

    // Validar password si llega
    if (password) {
      if (!passwordRegex.test(password)) {
        return res.status(400).json({
          message:
            "La contraseña debe tener mínimo 8 caracteres, incluyendo mayúsculas, minúsculas, números y un carácter especial.",
        });
      }
      usuario.password = await bcrypt.hash(password, 10);
    }

    usuario.nombre = nombre ?? usuario.nombre;
    usuario.cedula = cedula ?? usuario.cedula;
    usuario.email = email ?? usuario.email;
    usuario.rol = rol ?? usuario.rol;
    usuario.activo = activo ?? usuario.activo;

    await usuario.save();

    const { password: _, ...usuarioSinPassword } = usuario.toJSON();
    res.json(usuarioSinPassword);
  } catch (error) {
    console.error("Error al actualizar usuario:", error);
    res.status(500).json({ message: "Error al actualizar usuario", error });
  }
});

// Eliminar usuario
router.delete("/:id", async (req, res) => {
  try {
    const usuario = await Usuario.findByPk(req.params.id);

    if (!usuario) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    await usuario.destroy();
    res.json({ message: "Usuario eliminado correctamente" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al eliminar usuario", error });
  }
});

module.exports = router;
