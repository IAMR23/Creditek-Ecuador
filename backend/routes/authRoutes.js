const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const Usuario = require("../models/Usuario");
const UsuarioAgencia = require("../models/UsuarioAgencia");
const Agencia = require("../models/Agencia");
const Rol = require("../models/Rol");
const UsuarioPermiso = require("../models/UsuarioPermiso");
const Permiso = require("../models/Permiso");

const JWT_SECRET = process.env.JWT_SECRET || "tu_clave_secreta";


router.post("/login", async (req, res) => {
  try {
    const { email, password, rolId } = req.body;

    /* =========================
       1. Buscar usuario + rol
       ========================= */
    const usuario = await Usuario.findOne({
      where: { email },
      include: [
        {
          model: Rol,
          as: "rol",
          attributes: ["id", "nombre", "descripcion"],
        },
        {
          model: Rol,
          as: "roles",
          attributes: ["id", "nombre", "descripcion"],
          through: { attributes: [] },
        },
      ],
    });

    if (!usuario) {
      return res.status(400).json({ message: "Usuario o contraseña incorrectos" });
    }

    if (!usuario.activo) {
      return res.status(403).json({ message: "Usuario no activo" });
    }

    /* =========================
       2. Verificar contraseña
       ========================= */
    const isMatch = await bcrypt.compare(password, usuario.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Usuario o contraseña incorrectos" });
    }

    const rolesDisponibles = usuario.roles?.length
      ? usuario.roles
      : [usuario.rol].filter(Boolean);

    if (rolesDisponibles.length === 0) {
      return res.status(403).json({ message: "El usuario no tiene roles asignados" });
    }

    if (rolesDisponibles.length > 1 && !rolId) {
      return res.json({
        requiresRoleSelection: true,
        message: "Seleccione el rol con el que desea ingresar",
        roles: rolesDisponibles.map((rol) => ({
          id: rol.id,
          nombre: rol.nombre,
          descripcion: rol.descripcion,
        })),
      });
    }

    const rolSeleccionado = rolId
      ? rolesDisponibles.find((rol) => Number(rol.id) === Number(rolId))
      : rolesDisponibles[0];

    if (!rolSeleccionado) {
      return res.status(403).json({ message: "Rol no asignado al usuario" });
    }

    /* =========================
       3. Obtener agencias activas
       ========================= */
    const relaciones = await UsuarioAgencia.findAll({
      where: {
        usuarioId: usuario.id,
        activo: true,
      },
      include: [
        {
          model: Agencia,
          as: "agencia",
          attributes: ["id", "nombre", "direccion", "telefono", "ciudad"],
        },
      ],
    });

    if (relaciones.length === 0) {
      return res.status(400).json({
        message: "El usuario no tiene agencias activas",
      });
    }

    const agencias = relaciones.map((rel) => ({
      usuarioAgenciaId: rel.id,
      agenciaId: rel.agencia.id,
      nombre: rel.agencia.nombre,
      direccion: rel.agencia.direccion,
      telefono: rel.agencia.telefono,
      ciudad: rel.agencia.ciudad,
      rolAgencia: rel.rolAgencia,
    }));

    const agenciaPrincipal = agencias[0];

    /* =========================
       4. Obtener permisos globales del usuario
       ========================= */
    const permisosAsignados = await UsuarioPermiso.findAll({
      where: {
        usuarioId: usuario.id,
        activo: true,
      },
      include: [
        {
          model: Permiso,
          as: "permiso",
          attributes: ["id", "nombre"],
        },
      ],
    });

    /* =========================
       5. Crear JWT completo
       ========================= */
    const token = jwt.sign(
      {
        usuario: {
          id: usuario.id,
          nombre: usuario.nombre,
          email: usuario.email,

          rol: {
            id: rolSeleccionado.id,
            nombre: rolSeleccionado.nombre,
          },
          roles: rolesDisponibles.map((rol) => ({
            id: rol.id,
            nombre: rol.nombre,
          })),

          permisosAsignados: permisosAsignados.map((p) => p.permiso.nombre), 

          agencias,
          agenciaPrincipal,
        },
      },
      JWT_SECRET,
      { expiresIn: "12h" }
    );

    return res.json({
      message: "Login exitoso",
      token,
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Error en el login",
      error,
    });
  }
});

module.exports = router;
 
