const { randomUUID } = require("crypto");
const ConsejoEjecutivoPlan = require("../models/ConsejoEjecutivoPlan");
const Usuario = require("../models/Usuario");
const {
  consultarUsuariosAdmin,
} = require("./consejoEjecutivoUsuariosService");
const {
  obtenerSalaAutorizada,
} = require("./consejoEjecutivoSalasService");

const ESTADOS_VALIDOS = ["PENDIENTE", "EN_PROGRESO", "FINALIZADO"];
const CONDICIONES = {
  inexistencia: 4,
  inexistencia_extendida: 8,
  peligro: 6,
  emergencia: 5,
  normal: 4,
  afluencia: 4,
};
const BLOQUES = [
  "Actividades urgentes",
  "Actividades pendientes",
  "Ordenes que debo cumplir",
  "Ordenes que deben realizar mis juniors",
  "Meta para la semana",
  "Objetivos que contribuyen al plan estrategico",
];
const MAX_ITEMS_POR_GRUPO = 50;
const MAX_ITEMS_POR_PLAN = 250;

const includeAuditoria = [
  {
    model: Usuario,
    as: "creadoPor",
    attributes: ["id", "nombre", "email"],
  },
  {
    model: Usuario,
    as: "actualizadoPor",
    attributes: ["id", "nombre", "email"],
  },
];

const crearError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const validarFecha = (value) => {
  const fecha = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    throw crearError("La fecha es obligatoria y debe tener formato AAAA-MM-DD");
  }

  const parsed = new Date(`${fecha}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== fecha) {
    throw crearError("La fecha no es valida");
  }

  return fecha;
};

const validarCondicion = (value) => {
  const condicion = String(value || "").trim().toLowerCase();
  if (!Object.prototype.hasOwnProperty.call(CONDICIONES, condicion)) {
    throw crearError("La condicion no es valida");
  }
  return condicion;
};

const normalizarEstado = (value) => {
  const estado = String(value || "PENDIENTE")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "_");

  if (!ESTADOS_VALIDOS.includes(estado)) {
    throw crearError("Uno de los items tiene un estado no valido");
  }
  return estado;
};

const normalizarItems = (items, ubicacion, contador) => {
  if (items === undefined || items === null) return [];
  if (!Array.isArray(items)) {
    throw crearError(`${ubicacion} debe contener una lista de items`);
  }
  if (items.length > MAX_ITEMS_POR_GRUPO) {
    throw crearError(`${ubicacion} supera el limite de items permitido`);
  }

  return items.reduce((normalizados, item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw crearError(`${ubicacion}, item ${index + 1}, no es valido`);
    }

    const descripcion = String(item.descripcion || "").trim();
    const responsableVacio =
      item.responsableId === undefined ||
      item.responsableId === null ||
      item.responsableId === "";

    // Los formularios muestran una fila vacia por grupo; no se persiste hasta
    // que el usuario empiece a completarla.
    if (!descripcion && responsableVacio) return normalizados;

    if (!descripcion) {
      throw crearError(`${ubicacion}, item ${index + 1}, requiere descripcion`);
    }

    if (descripcion.length > 5000) {
      throw crearError(`${ubicacion}, item ${index + 1}, es demasiado extenso`);
    }

    const responsableId = Number(item.responsableId);
    if (!Number.isInteger(responsableId) || responsableId <= 0) {
      throw crearError(`${ubicacion}, item ${index + 1}, requiere un responsable Admin`);
    }

    contador.total += 1;
    if (contador.total > MAX_ITEMS_POR_PLAN) {
      throw crearError("El plan supera el limite total de items permitido");
    }

    const idRecibido = String(item.id || "").trim();
    normalizados.push({
      id: idRecibido && idRecibido.length <= 100 ? idRecibido : randomUUID(),
      descripcion,
      estado: normalizarEstado(item.estado),
      responsableId,
    });

    return normalizados;
  }, []);
};

const normalizarEstructuraItems = ({ condicion, respuestasFormula, detalle }) => {
  const contador = { total: 0 };
  const respuestas = {};

  for (let numero = 1; numero <= CONDICIONES[condicion]; numero += 1) {
    respuestas[numero] = normalizarItems(
      respuestasFormula?.[numero],
      `Pregunta ${numero}`,
      contador,
    );
  }

  const detalleNormalizado = BLOQUES.reduce((acc, bloque) => {
    acc[bloque] = normalizarItems(detalle?.[bloque], bloque, contador);
    return acc;
  }, {});

  return {
    respuestasFormula: respuestas,
    detalle: detalleNormalizado,
    totalItems: contador.total,
  };
};

const asignarResponsablesValidados = async (
  estructura,
  { responsableIdsPermitidos } = {},
) => {
  const todosItems = [
    ...Object.values(estructura.respuestasFormula).flat(),
    ...Object.values(estructura.detalle).flat(),
  ];
  const ids = [...new Set(todosItems.map((item) => item.responsableId))];
  if (!ids.length) return estructura;

  const responsables = await consultarUsuariosAdmin({ ids });
  const responsablesPorId = new Map(
    responsables.map((responsable) => [Number(responsable.id), responsable]),
  );
  const idsInvalidos = ids.filter((id) => !responsablesPorId.has(Number(id)));

  if (idsInvalidos.length) {
    throw crearError(
      "Todos los responsables deben ser usuarios activos con rol Admin o Administrador",
    );
  }

  const permitidos = new Set(
    (responsableIdsPermitidos || []).map((id) => Number(id)),
  );
  const idsNoInvitados = ids.filter((id) => !permitidos.has(Number(id)));
  if (idsNoInvitados.length) {
    throw crearError(
      "Todos los responsables deben ser participantes invitados de la sala",
    );
  }

  const agregarResponsable = (item) => ({
    ...item,
    responsableNombre: responsablesPorId.get(Number(item.responsableId)).nombre,
  });

  return {
    ...estructura,
    respuestasFormula: Object.fromEntries(
      Object.entries(estructura.respuestasFormula).map(([numero, items]) => [
        numero,
        items.map(agregarResponsable),
      ]),
    ),
    detalle: Object.fromEntries(
      Object.entries(estructura.detalle).map(([bloque, items]) => [
        bloque,
        items.map(agregarResponsable),
      ]),
    ),
  };
};

const normalizarPayload = async (data = {}, options = {}) => {
  const condicion = validarCondicion(data.condicion);
  const estructura = normalizarEstructuraItems({
    condicion,
    respuestasFormula:
      data.respuestasFormula && typeof data.respuestasFormula === "object"
        ? data.respuestasFormula
        : {},
    detalle: data.detalle && typeof data.detalle === "object" ? data.detalle : {},
  });

  if (!estructura.totalItems) {
    throw crearError("El plan debe contener al menos un item con responsable");
  }

  const estructuraValidada = await asignarResponsablesValidados(
    estructura,
    options,
  );
  const observaciones = String(data.observaciones || "").trim();

  if (observaciones.length > 10000) {
    throw crearError("Las observaciones son demasiado extensas");
  }

  return {
    fecha: validarFecha(data.fecha),
    condicion,
    respuestasFormula: estructuraValidada.respuestasFormula,
    detalle: estructuraValidada.detalle,
    observaciones,
  };
};

const serializarPlan = (plan) => {
  const item = plan?.get ? plan.get({ plain: true }) : plan;
  return {
    id: item.id,
    salaId: item.salaId,
    fecha: item.fecha,
    condicion: item.condicion,
    respuestasFormula: item.respuestasFormula || {},
    detalle: item.detalle || {},
    observaciones: item.observaciones || "",
    revision: item.revision,
    creadoPor: item.creadoPor || null,
    actualizadoPor: item.actualizadoPor || null,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
};

const obtenerPlanCompleto = async (id) => {
  const plan = await ConsejoEjecutivoPlan.findByPk(id, {
    include: includeAuditoria,
  });
  if (!plan) throw crearError("Plan no encontrado", 404);
  return plan;
};

const listarPlanes = async ({ user, filtros = {} }) => {
  const sala = await obtenerSalaAutorizada(filtros.salaId, user);
  const where = { salaId: sala.id };
  if (filtros.fecha) where.fecha = validarFecha(filtros.fecha);
  if (filtros.condicion && filtros.condicion !== "todas") {
    where.condicion = validarCondicion(filtros.condicion);
  }

  const planes = await ConsejoEjecutivoPlan.findAll({
    where,
    include: includeAuditoria,
    order: [
      ["fecha", "DESC"],
      ["updatedAt", "DESC"],
    ],
  });

  return planes.map(serializarPlan);
};

const crearPlan = async ({ user, data }) => {
  if (!user?.id) throw crearError("Usuario autenticado no valido", 401);
  const sala = await obtenerSalaAutorizada(data.salaId, user);
  const payload = await normalizarPayload(data, {
    responsableIdsPermitidos: sala.participantes.map(
      (participante) => participante.id,
    ),
  });
  const plan = await ConsejoEjecutivoPlan.create({
    ...payload,
    salaId: sala.id,
    revision: 1,
    creadoPorId: user.id,
    actualizadoPorId: user.id,
  });
  return serializarPlan(await obtenerPlanCompleto(plan.id));
};

const actualizarPlan = async ({ id, user, data }) => {
  if (!user?.id) throw crearError("Usuario autenticado no valido", 401);

  const planId = Number(id);
  if (!Number.isInteger(planId) || planId <= 0) {
    throw crearError("El identificador del plan no es valido");
  }

  const revision = Number(data?.revision);
  if (!Number.isInteger(revision) || revision < 1) {
    throw crearError("La revision del plan es obligatoria");
  }

  const actual = await ConsejoEjecutivoPlan.findByPk(planId);
  if (!actual) throw crearError("Plan no encontrado", 404);
  if (!actual.salaId) {
    throw crearError("El plan historico no esta asociado a una sala", 409);
  }

  const sala = await obtenerSalaAutorizada(actual.salaId, user);
  if (Number(actual.revision) !== revision) {
    throw crearError(
      "El plan fue actualizado por otra persona. Recarga los cambios antes de guardar.",
      409,
    );
  }
  if (data.salaId && Number(data.salaId) !== Number(actual.salaId)) {
    throw crearError("No se puede mover un plan a otra sala");
  }

  const payload = await normalizarPayload(data, {
    responsableIdsPermitidos: sala.participantes.map(
      (participante) => participante.id,
    ),
  });
  const [actualizados] = await ConsejoEjecutivoPlan.update(
    {
      ...payload,
      revision: revision + 1,
      actualizadoPorId: user.id,
    },
    { where: { id: planId, revision } },
  );

  if (!actualizados) {
    throw crearError(
      "El plan fue actualizado por otra persona. Recarga los cambios antes de guardar.",
      409,
    );
  }

  return serializarPlan(await obtenerPlanCompleto(planId));
};

const listarResponsables = () => consultarUsuariosAdmin();

module.exports = {
  BLOQUES,
  CONDICIONES,
  ESTADOS_VALIDOS,
  actualizarPlan,
  crearPlan,
  listarPlanes,
  listarResponsables,
};
