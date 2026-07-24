const express = require("express");
const { Op } = require("sequelize");
const PlanBatalla = require("../models/PlanBatalla");
const UsuarioAgencia = require("../models/UsuarioAgencia");
const Usuario = require("../models/Usuario");
const Agencia = require("../models/Agencia");
const { authenticate, requirePermission } = require("../middleware/authMiddleware");

const router = express.Router();
const CLAVE_IDEMPOTENCIA_REGEX = /^[a-zA-Z0-9._:-]{8,64}$/;

const includeUsuarioAgencia = ({ agenciaId, vendedorId } = {}) => ({
  model: UsuarioAgencia,
  as: "usuarioAgencia",
  attributes: ["id", "usuarioId", "agenciaId"],
  required: Boolean(agenciaId || vendedorId),
  where: {
    ...(agenciaId && agenciaId !== "todos" && { agenciaId: Number(agenciaId) }),
    ...(vendedorId && vendedorId !== "todos" && { usuarioId: Number(vendedorId) }),
  },
  include: [
    {
      model: Usuario,
      as: "usuario",
      attributes: ["id", "nombre", "email"],
    },
    {
      model: Agencia,
      as: "agencia",
      attributes: ["id", "nombre"],
    },
  ],
});

const serializarPlan = (plan) => {
  const item = plan.get ? plan.get({ plain: true }) : plan;
  const usuarioAgencia = item.usuarioAgencia || {};

  return {
    id: item.id,
    enviadoEn: item.createdAt,
    usuarioAgenciaId: item.usuarioAgenciaId,
    usuario: {
      id: usuarioAgencia.usuario?.id || null,
      nombre: usuarioAgencia.usuario?.nombre || "",
      email: usuarioAgencia.usuario?.email || "",
      usuarioAgenciaId: item.usuarioAgenciaId,
    },
    agencia: {
      id: usuarioAgencia.agencia?.id || null,
      nombre: usuarioAgencia.agencia?.nombre || "",
    },
    plan: {
      condicion: item.condicion,
      fechaInicio: item.fechaInicio,
      fechaFin: item.fechaFin,
      respuestasFormula: item.respuestasFormula || {},
      detalle: item.detalle || {},
      observacion: item.observacion || "",
    },
  };
};

const buildWherePlanes = ({ fechaInicio, fechaFin, condicion } = {}) => {
  const where = {};

  if (condicion && condicion !== "todos") {
    where.condicion = condicion;
  }

  if (fechaInicio && fechaFin) {
    where.fechaInicio = { [Op.between]: [fechaInicio, fechaFin] };
  } else if (fechaInicio) {
    where.fechaInicio = { [Op.gte]: fechaInicio };
  } else if (fechaFin) {
    where.fechaInicio = { [Op.lte]: fechaFin };
  }

  return where;
};

const buscarPlanPorClaveIdempotencia = (usuarioAgenciaId, claveIdempotencia) =>
  PlanBatalla.findOne({
    where: {
      usuarioAgenciaId,
      claveIdempotencia,
    },
    include: [includeUsuarioAgencia()],
  });

router.post("/", authenticate, async (req, res) => {
  let claveIdempotencia = null;

  try {
    const usuarioAgenciaId = req.user?.usuarioAgenciaId;
    if (!usuarioAgenciaId) {
      return res.status(400).json({
        ok: false,
        message: "Usuario sin relacion usuario-agencia",
      });
    }

    const {
      condicion,
      fechaInicio,
      fechaFin,
      respuestasFormula,
      detalle,
      observacion,
      claveIdempotencia: claveIdempotenciaRecibida,
    } = req.body;

    if (!condicion) {
      return res.status(400).json({ ok: false, message: "La condicion es obligatoria" });
    }

    if (claveIdempotenciaRecibida) {
      claveIdempotencia = String(claveIdempotenciaRecibida).trim();
      if (!CLAVE_IDEMPOTENCIA_REGEX.test(claveIdempotencia)) {
        return res.status(400).json({
          ok: false,
          message: "La clave de envio no es valida",
        });
      }

      const planExistente = await buscarPlanPorClaveIdempotencia(
        usuarioAgenciaId,
        claveIdempotencia,
      );

      if (planExistente) {
        return res.json({
          ok: true,
          deduplicado: true,
          plan: serializarPlan(planExistente),
        });
      }
    }

    if (fechaInicio && fechaFin && fechaInicio > fechaFin) {
      return res.status(400).json({
        ok: false,
        message: "La fecha inicio no puede ser mayor que la fecha fin",
      });
    }

    const plan = await PlanBatalla.create({
      usuarioAgenciaId,
      condicion,
      fechaInicio: fechaInicio || null,
      fechaFin: fechaFin || null,
      respuestasFormula: respuestasFormula || {},
      detalle: detalle || {},
      observacion: observacion || "",
      claveIdempotencia,
    });

    const planCompleto = await PlanBatalla.findByPk(plan.id, {
      include: [includeUsuarioAgencia()],
    });

    return res.status(201).json({
      ok: true,
      plan: serializarPlan(planCompleto),
    });
  } catch (error) {
    if (
      claveIdempotencia &&
      error.name === "SequelizeUniqueConstraintError"
    ) {
      const planExistente = await buscarPlanPorClaveIdempotencia(
        req.user.usuarioAgenciaId,
        claveIdempotencia,
      );

      if (planExistente) {
        return res.json({
          ok: true,
          deduplicado: true,
          plan: serializarPlan(planExistente),
        });
      }
    }

    console.error("Error creando plan de batalla:", error);
    return res.status(500).json({
      ok: false,
      message: "No se pudo guardar el plan de batalla",
    });
  }
});

router.get("/mios", authenticate, async (req, res) => {
  try {
    const where = {
      ...buildWherePlanes(req.query),
      usuarioAgenciaId: req.user.usuarioAgenciaId,
    };

    const planes = await PlanBatalla.findAll({
      where,
      include: [includeUsuarioAgencia()],
      order: [["createdAt", "DESC"]],
    });

    return res.json({ ok: true, planes: planes.map(serializarPlan) });
  } catch (error) {
    console.error("Error listando mis planes de batalla:", error);
    return res.status(500).json({
      ok: false,
      message: "No se pudieron obtener los planes",
    });
  }
});

router.get(
  "/",
  authenticate,
  requirePermission("Gerencia"),
  async (req, res) => {
    try {
      const { agenciaId, vendedorId } = req.query;

      const planes = await PlanBatalla.findAll({
        where: buildWherePlanes(req.query),
        include: [includeUsuarioAgencia({ agenciaId, vendedorId })],
        order: [["createdAt", "DESC"]],
      });

      return res.json({ ok: true, planes: planes.map(serializarPlan) });
    } catch (error) {
      console.error("Error listando planes de batalla:", error);
      return res.status(500).json({
        ok: false,
        message: "No se pudieron obtener los planes",
      });
    }
  },
);

router.put("/:id", authenticate, async (req, res) => {
  try {
    const usuarioAgenciaId = req.user?.usuarioAgenciaId;
    if (!usuarioAgenciaId) {
      return res.status(400).json({
        ok: false,
        message: "Usuario sin relacion usuario-agencia",
      });
    }

    const plan = await PlanBatalla.findOne({
      where: {
        id: req.params.id,
        usuarioAgenciaId,
      },
    });

    if (!plan) {
      return res.status(404).json({
        ok: false,
        message: "Plan no encontrado",
      });
    }

    const {
      condicion,
      fechaInicio,
      fechaFin,
      respuestasFormula,
      detalle,
      observacion,
    } = req.body;

    if (!condicion) {
      return res.status(400).json({
        ok: false,
        message: "La condicion es obligatoria",
      });
    }

    if (fechaInicio && fechaFin && fechaInicio > fechaFin) {
      return res.status(400).json({
        ok: false,
        message: "La fecha inicio no puede ser mayor que la fecha fin",
      });
    }

    await plan.update({
      condicion,
      fechaInicio: fechaInicio || null,
      fechaFin: fechaFin || null,
      respuestasFormula: respuestasFormula || {},
      detalle: detalle || {},
      observacion: observacion || "",
    });

    const planCompleto = await PlanBatalla.findByPk(plan.id, {
      include: [includeUsuarioAgencia()],
    });

    return res.json({
      ok: true,
      plan: serializarPlan(planCompleto),
    });
  } catch (error) {
    console.error("Error actualizando plan de batalla:", error);
    return res.status(500).json({
      ok: false,
      message: "No se pudo actualizar el plan de batalla",
    });
  }
});

router.delete("/:id", authenticate, async (req, res) => {
  try {
    const where = { id: req.params.id };
    const permisos = req.user?.permisos || [];
    const esGerencia = permisos.includes("Gerencia");

    if (!esGerencia) {
      where.usuarioAgenciaId = req.user.usuarioAgenciaId;
    }

    const eliminado = await PlanBatalla.destroy({ where });
    if (!eliminado) {
      return res.status(404).json({ ok: false, message: "Plan no encontrado" });
    }

    return res.json({ ok: true, message: "Plan eliminado" });
  } catch (error) {
    console.error("Error eliminando plan de batalla:", error);
    return res.status(500).json({
      ok: false,
      message: "No se pudo eliminar el plan",
    });
  }
});

module.exports = router;
