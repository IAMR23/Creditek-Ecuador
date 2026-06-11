const express = require("express");
const router = express.Router();
const Usuario = require("../models/Usuario");
const Rol = require("../models/Rol");
const UsuarioAgencia = require("../models/UsuarioAgencia");
const UsuarioRol = require("../models/UsuarioRol");
const bcrypt = require("bcryptjs");

const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d).{6,}$/;

const normalizarRolIds = (rolId, rolIds) => {
  const ids = Array.isArray(rolIds) ? rolIds : rolId ? [rolId] : [];
  return [...new Set(ids.map(Number).filter(Boolean))];
};

const validarRoles = async (rolIds) => {
  const roles = await Rol.findAll({ where: { id: rolIds } });
  if (roles.length !== rolIds.length) {
    throw new Error("Uno o mas roles especificados no existen.");
  }
  return roles;
};

const sincronizarRolesUsuario = async (usuarioId, rolIds) => {
  await UsuarioRol.destroy({ where: { usuarioId } });

  if (rolIds.length > 0) {
    await UsuarioRol.bulkCreate(
      rolIds.map((rolId) => ({
        usuarioId,
        rolId,
        activo: true,
      })),
    );
  }
};

// ===========================
// 🔹 CREAR USUARIO
// ===========================
router.post("/", async (req, res) => {
  try {
    const {
      nombre,
      cedula,
      email,
      password,
      rolId,
      rolIds,
      fechaIngreso,
      fechaSalida,
      numeroCuenta,
      direccion,
      telefono,
    } = req.body;

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

    const rolesIdsNormalizados = normalizarRolIds(rolId, rolIds);

    if (rolesIdsNormalizados.length === 0) {
      return res
        .status(400)
        .json({ message: "Debe asignar al menos un rol." });
    }

    try {
      await validarRoles(rolesIdsNormalizados);
    } catch (error) {
      return res
        .status(400)
        .json({ message: error.message });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const nuevoUsuario = await Usuario.create({
      nombre,
      cedula,
      email,
      password: hashedPassword,
      rolId: rolesIdsNormalizados[0],
      fechaIngreso,
      fechaSalida,
      numeroCuenta,
      direccion,
      telefono,
      activo: true,
    });

    await sincronizarRolesUsuario(nuevoUsuario.id, rolesIdsNormalizados);

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
      where: { activo: true },
      attributes: { exclude: ["password"] },
      include: [
        { model: Rol, as: "rol", attributes: ["id", "nombre"] },
        {
          model: Rol,
          as: "roles",
          attributes: ["id", "nombre"],
          through: { attributes: [] },
        },
      ],
      order: [["nombre", "ASC"]],
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
      include: [
        { model: Rol, as: "rol", attributes: ["id", "nombre"] },
        {
          model: Rol,
          as: "roles",
          attributes: ["id", "nombre"],
          through: { attributes: [] },
        },
      ],
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
const actualizarUsuario = async (req, res) => {
  try {
    const {
      nombre,
      cedula,
      email,
      password,
      rolId,
      rolIds,
      activo,
      fechaIngreso,
      fechaSalida,
      numeroCuenta,
      direccion,
      telefono,
    } = req.body;
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
    const debeActualizarRoles = rolId !== undefined || rolIds !== undefined;
    let rolesIdsNormalizados = null;

    if (debeActualizarRoles) {
      rolesIdsNormalizados = normalizarRolIds(rolId, rolIds);

      if (rolesIdsNormalizados.length === 0) {
        return res
          .status(400)
          .json({ message: "Debe asignar al menos un rol." });
      }

      try {
        await validarRoles(rolesIdsNormalizados);
      } catch (error) {
        return res.status(400).json({ message: error.message });
      }

      usuario.rolId = rolesIdsNormalizados[0];
    }

    // ========== CAMPOS NORMALES (solo si vienen) ==========
    if (nombre !== undefined) usuario.nombre = nombre;
    if (cedula !== undefined) usuario.cedula = cedula;
    if (activo !== undefined) usuario.activo = activo;
    if (fechaIngreso !== undefined) usuario.fechaIngreso = fechaIngreso;
    if (fechaSalida !== undefined) usuario.fechaSalida = fechaSalida;
    if (numeroCuenta !== undefined) usuario.numeroCuenta = numeroCuenta;
    if (direccion !== undefined) usuario.direccion = direccion;
    if (telefono !== undefined) usuario.telefono = telefono;

    await usuario.save();

    if (debeActualizarRoles) {
      await sincronizarRolesUsuario(usuario.id, rolesIdsNormalizados);
    }

    if (activo === false) {
      await UsuarioAgencia.update(
        { activo: false },
        { where: { usuarioId: usuario.id } },
      );
    }

    const { password: _, ...usuarioSinPassword } = usuario.toJSON();
    res.json(usuarioSinPassword);
  } catch (error) {
    res.status(500).json({ message: "Error al actualizar usuario", error });
  }
};

router.put("/:id", actualizarUsuario);
router.patch("/:id", actualizarUsuario);

// ===========================
// 🔹 ELIMINAR
// ===========================
router.delete("/:id", async (req, res) => {
  try {
    const usuario = await Usuario.findByPk(req.params.id);

    if (!usuario) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    await usuario.update({ activo: false });
    await UsuarioAgencia.update(
      { activo: false },
      { where: { usuarioId: usuario.id } },
    );

    res.json({ message: "Usuario desactivado correctamente" });
  } catch (error) {
    res.status(500).json({ message: "Error al eliminar usuario", error });
  }
});

module.exports = router;
