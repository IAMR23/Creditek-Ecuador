const express = require("express");
const { Op } = require("sequelize");
const { sequelize } = require("../config/db");
const UsuarioAgencia = require("../models/UsuarioAgencia");
const Usuario = require("../models/Usuario");
const Agencia = require("../models/Agencia");

const router = express.Router();

const desactivarOtrasAgencias = async ({ usuarioId, relacionActivaId, transaction }) => {
  await UsuarioAgencia.update(
    { activo: false },
    {
      where: {
        usuarioId,
        activo: true,
        id: { [Op.ne]: relacionActivaId },
      },
      transaction,
    }
  );
};

router.post("/", async (req, res) => {
  try {
    const { usuarioId, agenciaId, activo } = req.body;

    const usuario = await Usuario.findByPk(usuarioId);
    if (!usuario) return res.status(400).json({ message: "Usuario no encontrado" });
    if (!usuario.activo) {
      return res.status(400).json({ message: "No se puede asignar un usuario inactivo." });
    }

    const agencia = await Agencia.findByPk(agenciaId);
    if (!agencia) return res.status(400).json({ message: "Agencia no encontrada" });

    const relacion = await sequelize.transaction(async (transaction) => {
      const [registro, created] = await UsuarioAgencia.findOrCreate({
        where: { usuarioId, agenciaId },
        defaults: { usuarioId, agenciaId, activo: activo ?? true },
        transaction,
      });

      if (!created) {
        registro.activo = activo ?? true;
        await registro.save({ transaction });
      }

      if (registro.activo) {
        await desactivarOtrasAgencias({
          usuarioId,
          relacionActivaId: registro.id,
          transaction,
        });
      }

      return registro;
    });

    return res.status(201).json(relacion);
  } catch (error) {
    return res.status(500).json({ message: "Error al asignar usuario a agencia", error });
  }
});

router.get("/", async (_req, res) => {
  try {
    const relaciones = await UsuarioAgencia.findAll({
      include: [
        { model: Usuario, as: "usuario" },
        { model: Agencia, as: "agencia" },
      ],
      order: [["id", "ASC"]],
    });
    return res.json(relaciones);
  } catch (error) {
    return res.status(500).json({ message: "Error al obtener relaciones", error });
  }
});

router.get("/activos", async (_req, res) => {
  try {
    const relaciones = await UsuarioAgencia.findAll({
      where: { activo: true },
      include: [
        { model: Usuario, as: "usuario", where: { activo: true } },
        { model: Agencia, as: "agencia", where: { activo: true } },
      ],
      order: [["id", "ASC"]],
    });
    return res.json(relaciones);
  } catch (error) {
    return res.status(500).json({ message: "Error al obtener relaciones activas", error });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const relacion = await UsuarioAgencia.findByPk(req.params.id);
    if (!relacion) return res.status(404).json({ message: "Relacion no encontrada" });
    const { activo, agenciaId } = req.body;

    if (agenciaId !== undefined && Number(agenciaId) !== Number(relacion.agenciaId)) {
      return res.status(400).json({
        message:
          "Para cambiar de agencia, asigna o activa la nueva relacion. La asistencia historica se conserva en su agencia original.",
      });
    }

    await sequelize.transaction(async (transaction) => {
      relacion.activo = activo ?? relacion.activo;
      await relacion.save({ transaction });

      if (relacion.activo) {
        await desactivarOtrasAgencias({
          usuarioId: relacion.usuarioId,
          relacionActivaId: relacion.id,
          transaction,
        });
      }
    });

    return res.json(relacion);
  } catch (error) {
    return res.status(500).json({ message: "Error al actualizar relacion", error });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const relacion = await UsuarioAgencia.findByPk(req.params.id);
    if (!relacion) return res.status(404).json({ message: "Relacion no encontrada" });
    relacion.activo = false;
    await relacion.save();
    return res.json({ message: "Relacion desactivada correctamente" });
  } catch (error) {
    return res.status(500).json({ message: "Error al desactivar relacion", error });
  }
});

module.exports = router;
