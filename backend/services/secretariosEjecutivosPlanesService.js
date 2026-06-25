const SecretarioEjecutivoPlan = require("../models/SecretarioEjecutivoPlan");
const Usuario = require("../models/Usuario");
const Agencia = require("../models/Agencia");

const ESTADOS_VALIDOS = ["PENDIENTE", "EN_PROGRESO", "FINALIZADO"];
const PRIORIDADES_VALIDAS = ["BAJA", "MEDIA", "ALTA"];
const CONDICIONES_VALIDAS = [
  "inexistencia",
  "peligro",
  "emergencia",
  "normal",
  "afluencia",
];

const includeBase = [
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

const validarEstado = (estado) => {
  if (!estado) return "PENDIENTE";
  const normalizado = String(estado).trim().toUpperCase();
  if (!ESTADOS_VALIDOS.includes(normalizado)) {
    const error = new Error("Estado no valido");
    error.statusCode = 400;
    throw error;
  }
  return normalizado;
};

const validarPrioridad = (prioridad) => {
  const normalizada = String(prioridad || "").trim().toUpperCase();
  if (!PRIORIDADES_VALIDAS.includes(normalizada)) {
    const error = new Error("Prioridad no valida");
    error.statusCode = 400;
    throw error;
  }
  return normalizada;
};

const validarCondicion = (condicion) => {
  const normalizada = String(condicion || "inexistencia").trim().toLowerCase();
  if (!CONDICIONES_VALIDAS.includes(normalizada)) {
    const error = new Error("Condicion no valida");
    error.statusCode = 400;
    throw error;
  }
  return normalizada;
};

const validarCamposObligatorios = (data) => {
  if (!data.fecha) {
    const error = new Error("La fecha es obligatoria");
    error.statusCode = 400;
    throw error;
  }

  if (!String(data.objetivoDia || "").trim()) {
    const error = new Error("El objetivo del dia es obligatorio");
    error.statusCode = 400;
    throw error;
  }

  if (!String(data.actividadesPlanificadas || "").trim()) {
    const error = new Error("Las actividades planificadas son obligatorias");
    error.statusCode = 400;
    throw error;
  }
};

const crearObjetivoPorDefecto = (data) =>
  data.objetivoDia ||
  `Plan de batalla ${validarCondicion(data.condicion).toUpperCase()}`;

const crearActividadesPorDefecto = (data) => {
  if (data.actividadesPlanificadas) return data.actividadesPlanificadas;

  const respuestas = data.respuestasFormula || {};
  const detalle = data.detalle || {};

  return JSON.stringify({ respuestasFormula: respuestas, detalle });
};

const serializarPlan = (plan) => {
  const item = plan.get ? plan.get({ plain: true }) : plan;

  return {
    id: item.id,
    fecha: item.fecha,
    usuarioId: item.usuarioId,
    agenciaId: item.agenciaId,
    objetivoDia: item.objetivoDia,
    actividadesPlanificadas: item.actividadesPlanificadas,
    condicion: item.condicion,
    respuestasFormula: item.respuestasFormula || {},
    detalle: item.detalle || {},
    prioridad: item.prioridad,
    estado: item.estado,
    observaciones: item.observaciones || "",
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    usuario: item.usuario || null,
    agencia: item.agencia || null,
  };
};

const crearPlan = async ({ user, data }) => {
  if (!user?.id || !user?.agenciaId) {
    const error = new Error("Usuario sin agencia asignada");
    error.statusCode = 400;
    throw error;
  }

  const dataNormalizada = {
    ...data,
    objetivoDia: crearObjetivoPorDefecto(data),
    actividadesPlanificadas: crearActividadesPorDefecto(data),
  };

  validarCamposObligatorios(dataNormalizada);

  const plan = await SecretarioEjecutivoPlan.create({
    fecha: dataNormalizada.fecha,
    usuarioId: user.id,
    agenciaId: user.agenciaId,
    objetivoDia: String(dataNormalizada.objetivoDia).trim(),
    actividadesPlanificadas: String(dataNormalizada.actividadesPlanificadas).trim(),
    condicion: validarCondicion(dataNormalizada.condicion),
    respuestasFormula: dataNormalizada.respuestasFormula || {},
    detalle: dataNormalizada.detalle || {},
    prioridad: validarPrioridad(dataNormalizada.prioridad),
    estado: validarEstado(dataNormalizada.estado),
    observaciones: dataNormalizada.observaciones || "",
  });

  const completo = await SecretarioEjecutivoPlan.findByPk(plan.id, {
    include: includeBase,
  });

  return serializarPlan(completo);
};

const listarMisPlanes = async ({ user, filtros = {} }) => {
  const where = { usuarioId: user.id };

  if (filtros.fecha) where.fecha = filtros.fecha;
  if (filtros.estado && filtros.estado !== "todos") {
    where.estado = validarEstado(filtros.estado);
  }

  const planes = await SecretarioEjecutivoPlan.findAll({
    where,
    include: includeBase,
    order: [
      ["fecha", "DESC"],
      ["createdAt", "DESC"],
    ],
  });

  return planes.map(serializarPlan);
};

const obtenerPlanPropio = async ({ id, user }) => {
  const plan = await SecretarioEjecutivoPlan.findOne({
    where: {
      id,
      usuarioId: user.id,
    },
    include: includeBase,
  });

  if (!plan) {
    const error = new Error("Plan no encontrado");
    error.statusCode = 404;
    throw error;
  }

  return plan;
};

const actualizarPlan = async ({ id, user, data }) => {
  const plan = await obtenerPlanPropio({ id, user });

  const updates = {};

  if (data.fecha !== undefined) updates.fecha = data.fecha;
  if (data.objetivoDia !== undefined) {
    updates.objetivoDia = String(data.objetivoDia).trim();
  }
  if (data.actividadesPlanificadas !== undefined) {
    updates.actividadesPlanificadas = String(data.actividadesPlanificadas).trim();
  }
  if (data.condicion !== undefined) {
    updates.condicion = validarCondicion(data.condicion);
  }
  if (data.respuestasFormula !== undefined) {
    updates.respuestasFormula = data.respuestasFormula || {};
  }
  if (data.detalle !== undefined) {
    updates.detalle = data.detalle || {};
  }
  if (data.prioridad !== undefined) {
    updates.prioridad = validarPrioridad(data.prioridad);
  }
  if (data.estado !== undefined) {
    updates.estado = validarEstado(data.estado);
  }
  if (data.observaciones !== undefined) {
    updates.observaciones = data.observaciones || "";
  }

  validarCamposObligatorios({
    fecha: updates.fecha ?? plan.fecha,
    objetivoDia: updates.objetivoDia ?? plan.objetivoDia,
    actividadesPlanificadas:
      updates.actividadesPlanificadas ?? plan.actividadesPlanificadas,
  });

  await plan.update(updates);

  const actualizado = await SecretarioEjecutivoPlan.findByPk(plan.id, {
    include: includeBase,
  });

  return serializarPlan(actualizado);
};

const cambiarEstado = async ({ id, user, estado }) =>
  actualizarPlan({ id, user, data: { estado } });

module.exports = {
  ESTADOS_VALIDOS,
  PRIORIDADES_VALIDAS,
  crearPlan,
  listarMisPlanes,
  actualizarPlan,
  cambiarEstado,
};
