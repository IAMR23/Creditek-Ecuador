const express = require("express");
const router = express.Router();
const UsuarioAgencia = require("../models/UsuarioAgencia");
const Usuario = require("../models/Usuario");
const Agencia = require("../models/Agencia");
const { authenticate, requirePermission } = require("../middleware/authMiddleware");
const {
  desactivarUsuarioAgencia,
} = require("../services/entregaOperacionService");

const accesoAdministracion = [authenticate, requirePermission("Administracion")];
const manejarError = (res, error, fallback) =>
  res.status(error.statusCode || 500).json({
    code: error.code || "USUARIO_AGENCIA_ERROR",
    message: error.message || fallback,
    ...(error.details || {}),
  });

router.post("/", ...accesoAdministracion, async (req, res) => {
  try {
    const { usuarioId, agenciaId, activo } = req.body;
    const usuario = await Usuario.findByPk(usuarioId);
    if (!usuario) return res.status(400).json({ message: "Usuario no encontrado" });
    const agencia = await Agencia.findByPk(agenciaId);
    if (!agencia) return res.status(400).json({ message: "Agencia no encontrada" });
    const existing = await UsuarioAgencia.findOne({ where: { usuarioId, agenciaId } });
    if (existing) {
      return res.status(400).json({ message: "El usuario ya esta asignado a esta agencia" });
    }
    const relacion = await UsuarioAgencia.create({
      usuarioId,
      agenciaId,
      activo: activo ?? true,
    });
    return res.status(201).json(relacion);
  } catch (error) {
    console.error(error);
    return manejarError(res, error, "Error al asignar usuario a agencia");
  }
});

router.get("/", ...accesoAdministracion, async (req, res) => {
  try {
    const relaciones = await UsuarioAgencia.findAll({
      include: [
        { model: Usuario, as: "usuario" },
        { model: Agencia, as: "agencia" },
      ],
    });
    return res.json(relaciones);
  } catch (error) {
    console.error(error);
    return manejarError(res, error, "Error al obtener relaciones");
  }
});

router.get("/activos", ...accesoAdministracion, async (req, res) => {
  try {
    const relaciones = await UsuarioAgencia.findAll({
      where: { activo: true },
      include: [
        { model: Usuario, as: "usuario" },
        { model: Agencia, as: "agencia" },
      ],
      order: [["id", "ASC"]],
    });
    return res.json(relaciones);
  } catch (error) {
    console.error(error);
    return manejarError(res, error, "Error al obtener relaciones activas");
  }
});

router.get("/:id", ...accesoAdministracion, async (req, res) => {
  try {
    const relacion = await UsuarioAgencia.findByPk(req.params.id, {
      include: [
        { model: Usuario, as: "usuario" },
        { model: Agencia, as: "agencia" },
      ],
    });
    if (!relacion) return res.status(404).json({ message: "Relacion no encontrada" });
    return res.json(relacion);
  } catch (error) {
    console.error(error);
    return manejarError(res, error, "Error al obtener relacion");
  }
});

router.put("/:id", ...accesoAdministracion, async (req, res) => {
  try {
    const { activo, responsableDestinoId, motivo, idempotencyKey } = req.body;
    if (activo === false) {
      const resultado = await desactivarUsuarioAgencia({
        usuarioAgenciaId: req.params.id,
        responsableDestinoId,
        actorUsuarioId: req.user.id,
        motivo: motivo || "Desactivacion de relacion usuario-agencia",
        idempotencyKey: idempotencyKey || req.get("Idempotency-Key") || null,
        scopeAgenciaId: null,
      });
      return res.json(resultado);
    }

    const relacion = await UsuarioAgencia.findByPk(req.params.id);
    if (!relacion) return res.status(404).json({ message: "Relacion no encontrada" });
    relacion.activo = activo ?? relacion.activo;
    await relacion.save();
    return res.json(relacion);
  } catch (error) {
    console.error(error);
    return manejarError(res, error, "Error al actualizar relacion");
  }
});

// Se conserva la ruta por compatibilidad, pero ya no elimina historial.
router.delete("/:id", ...accesoAdministracion, async (req, res) => {
  try {
    const resultado = await desactivarUsuarioAgencia({
      usuarioAgenciaId: req.params.id,
      responsableDestinoId: req.body?.responsableDestinoId,
      actorUsuarioId: req.user.id,
      motivo: req.body?.motivo || "Desactivacion solicitada desde eliminar relacion",
      idempotencyKey: req.body?.idempotencyKey || req.get("Idempotency-Key") || null,
      scopeAgenciaId: null,
    });
    return res.json({ message: "Relacion desactivada correctamente", ...resultado });
  } catch (error) {
    console.error(error);
    return manejarError(res, error, "Error al desactivar relacion");
  }
});

module.exports = router;
