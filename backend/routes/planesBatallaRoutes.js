const express = require("express");
const { Op } = require("sequelize");
const PlanBatalla = require("../models/PlanBatalla");
const SecretarioEjecutivoPlan = require("../models/SecretarioEjecutivoPlan");
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

const includeSecretarioEjecutivo = [
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
];

const serializarPlan = (plan) => {
  const item = plan.get ? plan.get({ plain: true }) : plan;
  const usuarioAgencia = item.usuarioAgencia || {};

  return {
    id: item.id,
    origen: "vendedor",
    puedeEliminar: true,
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

const serializarPlanSecretarioEjecutivo = (plan) => {
  const item = plan.get ? plan.get({ plain: true }) : plan;

  return {
    id: item.id,
    origen: "secretario_ejecutivo",
    puedeEliminar: true,
    enviadoEn: item.createdAt,
    usuarioAgenciaId: null,
    usuario: {
      id: item.usuario?.id || item.usuarioId || null,
      nombre: item.usuario?.nombre || "",
      email: item.usuario?.email || "",
      usuarioAgenciaId: null,
    },
    agencia: {
      id: item.agencia?.id || item.agenciaId || null,
      nombre: item.agencia?.nombre || "",
    },
    estado: item.estado || "",
    prioridad: item.prioridad || "",
    plan: {
      condicion: item.condicion,
      fechaInicio: item.fecha,
      fechaFin: item.fecha,
      respuestasFormula: item.respuestasFormula || {},
      detalle: item.detalle || {},
      observacion: item.observaciones || "",
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

const buildWherePlanesSecretarios = ({
  fechaInicio,
  fechaFin,
  condicion,
  agenciaId,
  vendedorId,
} = {}) => {
  const where = {};

  if (condicion && condicion !== "todos") {
    where.condicion = condicion;
  }

  if (fechaInicio && fechaFin) {
    where.fecha = { [Op.between]: [fechaInicio, fechaFin] };
  } else if (fechaInicio) {
    where.fecha = { [Op.gte]: fechaInicio };
  } else if (fechaFin) {
    where.fecha = { [Op.lte]: fechaFin };
  }

  if (agenciaId && agenciaId !== "todos") {
    where.agenciaId = Number(agenciaId);
  }

  if (vendedorId && vendedorId !== "todos") {
    where.usuarioId = Number(vendedorId);
  }

  return where;
};

const ordenarPlanesPorEnvio = (a, b) => {
  const fechaA = new Date(a.enviadoEn || 0).getTime();
  const fechaB = new Date(b.enviadoEn || 0).getTime();
  return fechaB - fechaA;
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

      const [planesVendedores, planesSecretarios] = await Promise.all([
        PlanBatalla.findAll({
          where: buildWherePlanes(req.query),
          include: [includeUsuarioAgencia({ agenciaId, vendedorId })],
          order: [["createdAt", "DESC"]],
        }),
        SecretarioEjecutivoPlan.findAll({
          where: buildWherePlanesSecretarios(req.query),
          include: includeSecretarioEjecutivo,
          order: [["createdAt", "DESC"]],
        }),
      ]);

      const planes = [
        ...planesVendedores.map(serializarPlan),
        ...planesSecretarios.map(serializarPlanSecretarioEjecutivo),
      ].sort(ordenarPlanesPorEnvio);

      return res.json({ ok: true, planes });
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
    const origen = String(req.query.origen || "vendedor").trim().toLowerCase();
    const permisos = req.user?.permisos || [];
    const esGerencia = permisos.includes("Gerencia");

    if (!["vendedor", "secretario_ejecutivo"].includes(origen)) {
      return res.status(400).json({
        ok: false,
        message: "Origen de plan no valido",
      });
    }

    if (origen === "secretario_ejecutivo") {
      if (!esGerencia) {
        return res.status(403).json({
          ok: false,
          message: "No tienes permisos para esta accion",
        });
      }

      const eliminado = await SecretarioEjecutivoPlan.destroy({
        where: { id: req.params.id },
      });

      if (!eliminado) {
        return res.status(404).json({ ok: false, message: "Plan no encontrado" });
      }

      return res.json({ ok: true, message: "Plan eliminado" });
    }

    const where = { id: req.params.id };

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
