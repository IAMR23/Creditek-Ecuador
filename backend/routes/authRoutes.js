const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const Usuario = require("../models/Usuario");
const UsuarioAgencia = require("../models/UsuarioAgencia");
const Agencia = require("../models/Agencia");
const Rol = require("../models/Rol");
const UsuarioAgenciaPermiso = require("../models/UsuarioAgenciaPermiso");
const Permiso = require("../models/Permiso");

const JWT_SECRET = process.env.JWT_SECRET || "tu_clave_secreta";


router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

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
       4. Obtener permisos
       (UsuarioAgenciaPermiso)
       ========================= */
    const permisosAsignados = await UsuarioAgenciaPermiso.findAll({
      where: {
        usuarioAgenciaId: relaciones.map((r) => r.id),
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
            id: usuario.rol.id,
            nombre: usuario.rol.nombre,
          },

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
 