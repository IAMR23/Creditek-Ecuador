const express = require("express");
const router = express.Router();
const Usuario = require("../models/Usuario");
const Rol = require("../models/Rol");
const UsuarioAgencia = require("../models/UsuarioAgencia");
const UsuarioRol = require("../models/UsuarioRol");
const RolPago = require("../models/RolPago");
const NominaEmpleado = require("../models/NominaEmpleado");
const bcrypt = require("bcryptjs");
const {
  condicionCampoNormalizado,
  crearBaseUsuarioDesdeEmail,
  esUsuarioValido,
  normalizarUsuario,
} = require("../utils/usuarioLogin");

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

const normalizarTexto = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const buscarUsuarioPorNombre = (nombreUsuario) =>
  Usuario.findOne({
    where: condicionCampoNormalizado("usuario", nombreUsuario),
  });

const generarUsuarioDisponible = async (email) => {
  const base = crearBaseUsuarioDesdeEmail(email);
  let candidato = base;
  let sufijo = 2;

  while (await buscarUsuarioPorNombre(candidato)) {
    candidato = `${base.slice(0, 46)}_${sufijo}`;
    sufijo += 1;
  }

  return candidato;
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

const calcularSueldoRolPago = (rolPago) =>
  Number((Number(rolPago.sueldoBase || 0) + Number(rolPago.sueldoExtra || 0)).toFixed(2));

const obtenerRolPagoActivo = async (rolPagoId) => {
  if (!rolPagoId) return null;

  const rolPago = await RolPago.findOne({
    where: {
      id: Number(rolPagoId),
      activo: true,
    },
  });

  if (!rolPago) {
    throw new Error("Rol de pago activo no encontrado.");
  }

  return rolPago;
};

const sincronizarRolPagoNominaUsuario = async (usuarioId, rolPago) => {
  if (!rolPago) {
    await NominaEmpleado.update(
      { rolPagoId: null },
      { where: { usuarioId } },
    );
    return;
  }

  await NominaEmpleado.update(
    {
      rolPagoId: rolPago.id,
      cargo: rolPago.cargo,
      sueldo: calcularSueldoRolPago(rolPago),
    },
    { where: { usuarioId } },
  );
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
      usuario: nombreUsuario,
      password,
      rolId,
      rolIds,
      fechaIngreso,
      fechaSalida,
      numeroCuenta,
      entidadFinanciera,
      direccion,
      telefono,
      rolPagoId,
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

    const usuarioNormalizado = nombreUsuario
      ? normalizarUsuario(nombreUsuario)
      : await generarUsuarioDisponible(email);

    if (!esUsuarioValido(usuarioNormalizado)) {
      return res.status(400).json({
        message:
          "El usuario debe tener entre 3 y 50 caracteres y usar solo letras, numeros, punto, guion o guion bajo.",
      });
    }

    if (await buscarUsuarioPorNombre(usuarioNormalizado)) {
      return res.status(400).json({
        message: "El nombre de usuario ya esta registrado.",
      });
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

    let rolPago = null;
    try {
      rolPago = await obtenerRolPagoActivo(rolPagoId);
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const nuevoUsuario = await Usuario.create({
      nombre,
      cedula,
      email,
      usuario: usuarioNormalizado,
      password: hashedPassword,
      rolId: rolesIdsNormalizados[0],
      fechaIngreso,
      fechaSalida,
      numeroCuenta,
      entidadFinanciera,
      direccion,
      telefono,
      rolPagoId: rolPago?.id || null,
      activo: true,
    });

    await sincronizarRolesUsuario(nuevoUsuario.id, rolesIdsNormalizados);
    await sincronizarRolPagoNominaUsuario(nuevoUsuario.id, rolPago);

    const { password: _, ...usuarioSinPassword } = nuevoUsuario.toJSON();
    res.status(201).json(usuarioSinPassword);
  } catch (error) {
    console.error("Error creando usuario:", error);
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(400).json({
        message: "El email o nombre de usuario ya esta registrado.",
      });
    }
    res.status(500).json({ message: "Error al crear el usuario", error });
  }
});

// ===========================
// 🔹 OBTENER TODOS
// ===========================
router.get("/", async (req, res) => {
  try {
    const incluirInactivos = ["true", "1", "si", "sí"].includes(
      String(req.query.incluirInactivos || req.query.todos || "")
        .trim()
        .toLowerCase(),
    );
    const rolFiltro = String(req.query.rol || req.query.rolNombre || "").trim();
    const includeRoles = {
      model: Rol,
      as: "roles",
      attributes: ["id", "nombre"],
      through: { attributes: [] },
    };

    const usuarios = await Usuario.findAll({
      where: incluirInactivos ? {} : { activo: true },
      attributes: { exclude: ["password"] },
      include: [
      { model: Rol, as: "rol", attributes: ["id", "nombre"] },
        { model: RolPago, as: "rolPago" },
        includeRoles,
      ],
      order: [["nombre", "ASC"]],
    });

    if (!rolFiltro) {
      return res.json(usuarios);
    }

    const rolNormalizado = normalizarTexto(rolFiltro);
    const usuariosFiltrados = usuarios.filter((usuario) => {
      const rolPrincipal = normalizarTexto(usuario.rol?.nombre);
      const rolesAsignados = Array.isArray(usuario.roles) ? usuario.roles : [];

      return (
        rolPrincipal === rolNormalizado ||
        rolesAsignados.some((rol) => normalizarTexto(rol.nombre) === rolNormalizado)
      );
    });

    res.json(usuariosFiltrados);
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
        { model: RolPago, as: "rolPago" },
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
      usuario: nombreUsuario,
      password,
      rolId,
      rolIds,
      activo,
      fechaIngreso,
      fechaSalida,
      numeroCuenta,
      entidadFinanciera,
      direccion,
      telefono,
      rolPagoId,
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

    if (nombreUsuario !== undefined) {
      const usuarioNormalizado = normalizarUsuario(nombreUsuario);

      if (!esUsuarioValido(usuarioNormalizado)) {
        return res.status(400).json({
          message:
            "El usuario debe tener entre 3 y 50 caracteres y usar solo letras, numeros, punto, guion o guion bajo.",
        });
      }

      const existeUsuario = await buscarUsuarioPorNombre(usuarioNormalizado);
      if (existeUsuario && Number(existeUsuario.id) !== Number(usuario.id)) {
        return res.status(400).json({
          message: "El nombre de usuario ya esta registrado.",
        });
      }

      usuario.usuario = usuarioNormalizado;
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

    const debeActualizarRolPago = rolPagoId !== undefined;
    let rolPago = null;

    if (debeActualizarRolPago) {
      try {
        rolPago = await obtenerRolPagoActivo(rolPagoId);
      } catch (error) {
        return res.status(400).json({ message: error.message });
      }

      usuario.rolPagoId = rolPago?.id || null;
    }

    // ========== CAMPOS NORMALES (solo si vienen) ==========
    if (nombre !== undefined) usuario.nombre = nombre;
    if (cedula !== undefined) usuario.cedula = cedula;
    if (activo !== undefined) usuario.activo = activo;
    if (fechaIngreso !== undefined) usuario.fechaIngreso = fechaIngreso;
    if (fechaSalida !== undefined) usuario.fechaSalida = fechaSalida;
    if (numeroCuenta !== undefined) usuario.numeroCuenta = numeroCuenta;
    if (entidadFinanciera !== undefined) usuario.entidadFinanciera = entidadFinanciera;
    if (direccion !== undefined) usuario.direccion = direccion;
    if (telefono !== undefined) usuario.telefono = telefono;

    await usuario.save();

    if (debeActualizarRoles) {
      await sincronizarRolesUsuario(usuario.id, rolesIdsNormalizados);
    }

    if (debeActualizarRolPago) {
      await sincronizarRolPagoNominaUsuario(usuario.id, rolPago);
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
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(400).json({
        message: "El email o nombre de usuario ya esta registrado.",
      });
    }
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
