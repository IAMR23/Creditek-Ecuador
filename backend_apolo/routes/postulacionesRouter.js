const express = require("express");
const {
  Op,
  col,
  fn,
  json,
  literal,
  where: sequelizeWhere,
} = require("sequelize");

const Postulacion = require("../models/Postulacion");
const Usuario = require("../models/Usuario");
const UsuarioAgencia = require("../models/UsuarioAgencia");
const auth = require("../middleware/auth");
const {
  generarContratoCapacitacionPdf,
} = require("../services/contratoCapacitacionPdfService");
const {
  buildTrainingTest,
  getTrainingTestTypes,
  gradeTrainingTest,
} = require("../services/capacitacionPruebaService");

const router = express.Router();
const INTERVIEW_STATUSES = [
  "PENDIENTE",
  "AGENDADA",
  "CONFIRMADA",
  "REPROGRAMADA",
  "REALIZADA",
  "NO_CONTESTO",
  "NO_ASISTIO",
  "CANCELADA",
  "SELECCIONADO",
  "CAPACITACION",
  "NO_ASISTIO_CAP",
];
const SELECTED_INTERVIEW_STATUSES = ["SELECCIONADO"];
const TRAINING_INTERVIEW_STATUSES = ["CAPACITACION", "NO_ASISTIO_CAP"];
const POST_INTERVIEW_STATUSES = [
  ...SELECTED_INTERVIEW_STATUSES,
  ...TRAINING_INTERVIEW_STATUSES,
];
const ACTIVE_INTERVIEW_STATUSES = ["AGENDADA", "CONFIRMADA", "REPROGRAMADA"];
const INTERVIEW_MODALITIES = ["PRESENCIAL", "VIRTUAL"];
const PERFORMANCE_RECOMMENDATIONS = [
  "APROBADO",
  "APROBADO_CON_OBSERVACIONES",
  "NO_APROBADO",
];
const PERFORMANCE_CRITERIA = {
  quiere_hacer: [
    "iniciativa_actitud",
    "ganas_aprender",
    "proactividad",
    "cumplimiento_metas",
    "disposicion_venta",
    "volanteo_comunicacion",
  ],
  sabe_hacer: [
    "proceso_venta",
    "uso_herramientas",
    "argumentacion_beneficios",
    "manejo_objeciones",
    "registro_informacion",
  ],
  disciplinada: [
    "horarios_normas",
    "constancia",
    "organizacion_tiempo",
    "cumplimiento_tareas",
    "orden_actitud",
  ],
};
const PERFORMANCE_CRITERION_IDS = Object.values(PERFORMANCE_CRITERIA).flat();
const GUAYAQUIL_OFFSET_MS = 5 * 60 * 60 * 1000;
const MAX_TXT_CONTENT_BYTES = 75 * 1024;
const REFERENCE_CONFIG = {
  familiar: {
    collectionKey: "personas_con_quien_vive",
    fields: {
      nombre: { label: "El nombre", maxLength: 150, required: true },
      pariente: { label: "El parentesco", maxLength: 80, required: true },
      telefono: { label: "El telefono", maxLength: 30, required: true },
      ocupacion: { label: "La ocupacion", maxLength: 120 },
      tituloProfesion: { label: "La profesion", maxLength: 120 },
      observacion: { label: "La observacion", maxLength: 1000 },
    },
  },
  laboral: {
    collectionKey: "historial_laboral",
    fields: {
      empresaLugarTrabajo: {
        label: "La empresa o lugar de trabajo",
        maxLength: 150,
        required: true,
      },
      cargoActividadRealizada: { label: "El cargo", maxLength: 120 },
      tiempoTrabajado: { label: "El tiempo trabajado", maxLength: 80 },
      motivoSalida: { label: "El motivo de salida", maxLength: 300 },
      jefeEncargado: {
        label: "El jefe o encargado",
        maxLength: 150,
        required: true,
      },
      telefonoReferencia: {
        label: "El telefono de referencia",
        maxLength: 30,
        required: true,
      },
      observacion: { label: "La observacion", maxLength: 1000 },
    },
  },
};

const isEmptyValue = (value) => value === "" || value === null || value === undefined;

const clean = (obj = {}) =>
  Object.fromEntries(
    Object.entries(obj).filter(([, value]) => {
      if (isEmptyValue(value)) return false;
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === "object") return Object.keys(value).length > 0;
      return true;
    })
  );

const tieneDatos = (obj = {}) => Object.values(obj).some((value) => !isEmptyValue(value));

const normalizeLimitedText = (value, maxLength, fieldName) => {
  if (value === null || value === undefined) return "";
  if (typeof value !== "string") {
    const error = new Error(`${fieldName} debe ser texto.`);
    error.statusCode = 400;
    throw error;
  }

  const normalized = value.trim();
  if (normalized.length > maxLength) {
    const error = new Error(`${fieldName} no puede superar ${maxLength} caracteres.`);
    error.statusCode = 400;
    throw error;
  }

  return normalized;
};

const buildReference = (type, payload = {}) => {
  const config = REFERENCE_CONFIG[type];
  const reference = {};

  for (const [field, rules] of Object.entries(config.fields)) {
    const value = normalizeLimitedText(
      payload[field],
      rules.maxLength,
      rules.label,
    );

    if (rules.required && !value) {
      const error = new Error(`${rules.label} es obligatorio.`);
      error.statusCode = 400;
      throw error;
    }

    if (value) reference[field] = value;
  }

  return { ...reference, llamado: false };
};

const normalizeOptionalDate = (value, fieldName) => {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const error = new Error(`${fieldName} debe tener el formato AAAA-MM-DD.`);
    error.statusCode = 400;
    throw error;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    const error = new Error(`${fieldName} no es una fecha valida.`);
    error.statusCode = 400;
    throw error;
  }

  return value;
};

const buildPerformanceEvaluation = (payload = {}, existing = {}, user = {}) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    const error = new Error("La evaluacion enviada no es valida.");
    error.statusCode = 400;
    throw error;
  }

  const periodoDesde = normalizeOptionalDate(payload.periodoDesde, "El inicio del periodo");
  const periodoHasta = normalizeOptionalDate(payload.periodoHasta, "El fin del periodo");
  const fechaEvaluacion = normalizeOptionalDate(payload.fechaEvaluacion, "La fecha de evaluacion");

  if (periodoDesde && periodoHasta && periodoDesde > periodoHasta) {
    const error = new Error("El inicio del periodo no puede ser posterior a su fecha final.");
    error.statusCode = 400;
    throw error;
  }

  const rawRatings = payload.calificaciones || {};
  if (typeof rawRatings !== "object" || Array.isArray(rawRatings)) {
    const error = new Error("Las calificaciones deben enviarse por criterio.");
    error.statusCode = 400;
    throw error;
  }

  const calificaciones = {};
  for (const criterionId of PERFORMANCE_CRITERION_IDS) {
    const value = rawRatings[criterionId];
    if (value === "" || value === null || value === undefined) continue;

    const rating = Number(value);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      const error = new Error("Cada calificacion debe ser un entero entre 1 y 5.");
      error.statusCode = 400;
      throw error;
    }
    calificaciones[criterionId] = rating;
  }

  const rawObservations = payload.observaciones || {};
  if (typeof rawObservations !== "object" || Array.isArray(rawObservations)) {
    const error = new Error("Las observaciones de aspectos no son validas.");
    error.statusCode = 400;
    throw error;
  }
  const observaciones = Object.fromEntries(
    Object.keys(PERFORMANCE_CRITERIA).map((aspectId) => [
      aspectId,
      normalizeLimitedText(
        rawObservations[aspectId],
        1500,
        "La observacion del aspecto",
      ),
    ]),
  );

  if (!Array.isArray(payload.ventas) || payload.ventas.length !== 6) {
    const error = new Error("Debe registrar las ventas de los 6 dias de capacitacion.");
    error.statusCode = 400;
    throw error;
  }
  const ventas = payload.ventas.map((value) => {
    const saleCount = value === "" || value === null ? 0 : Number(value);
    if (!Number.isInteger(saleCount) || saleCount < 0 || saleCount > 999) {
      const error = new Error("Las ventas diarias deben ser enteros entre 0 y 999.");
      error.statusCode = 400;
      throw error;
    }
    return saleCount;
  });

  const recomendacion = normalizeLimitedText(
    payload.recomendacion,
    40,
    "La recomendacion",
  );
  if (recomendacion && !PERFORMANCE_RECOMMENDATIONS.includes(recomendacion)) {
    const error = new Error("La recomendacion seleccionada no es valida.");
    error.statusCode = 400;
    throw error;
  }

  const puntajeAspectos = Number(
    Object.values(PERFORMANCE_CRITERIA)
      .reduce((total, criteria) => {
        const sum = criteria.reduce(
          (aspectTotal, criterionId) =>
            aspectTotal + (calificaciones[criterionId] || 0),
          0,
        );
        return total + (sum / criteria.length) * 5;
      }, 0)
      .toFixed(2),
  );
  const totalVentas = ventas.reduce((total, value) => total + value, 0);
  const puntajeVentas = Math.min(totalVentas * 5, 25);
  const puntajeTotal = Number((puntajeAspectos + puntajeVentas).toFixed(2));
  const now = new Date().toISOString();

  return {
    version: "evaluacion-desempeno-v1",
    periodoDesde,
    periodoHasta,
    evaluador: normalizeLimitedText(payload.evaluador, 120, "El evaluador"),
    fechaEvaluacion,
    calificaciones,
    observaciones,
    ventas,
    totalVentas,
    metaCumplida: totalVentas >= 4,
    puntajeAspectos,
    puntajeVentas,
    puntajeTotal,
    cumpleAprobacion: puntajeTotal >= 60 && totalVentas >= 4,
    comentariosGenerales: normalizeLimitedText(
      payload.comentariosGenerales,
      3000,
      "Los comentarios generales",
    ),
    recomendacion,
    firmaEvaluador: normalizeLimitedText(
      payload.firmaEvaluador,
      120,
      "La firma del evaluador",
    ),
    creadoAt: existing.creadoAt || now,
    actualizadoAt: now,
    actualizadoPor: {
      id: user.id || null,
      nombre: user.nombre || user.email || "Usuario ABS",
    },
  };
};

const normalizeArray = (value) => (Array.isArray(value) ? value.map(clean).filter(tieneDatos) : []);

const normalizeTextKey = (value = "") =>
  String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const normalizeTxtLine = (value = "") => String(value).replace(/\r/g, "").trim();

const parseTxtHeading = (heading = "") => {
  const etiquetaOriginal = normalizeTxtLine(heading);
  const parts = etiquetaOriginal
    .split("-")
    .map((part) => part.trim())
    .filter(Boolean);
  const firstPart = parts[0] || etiquetaOriginal;
  const familiarMatch = firstPart.match(/^FAMILIAR\s+(\d+)/i);

  if (familiarMatch) {
    return clean({
      tipo: "FAMILIAR",
      numero: familiarMatch[1],
      relacion: parts[1] || "FAMILIAR",
      detalle: parts.slice(2).join(" - "),
      etiquetaOriginal,
    });
  }

  return clean({
    tipo: firstPart.toUpperCase(),
    relacion: firstPart.toUpperCase(),
    etiquetaOriginal,
  });
};

const assignTxtField = (record, rawKey, rawValue) => {
  const key = normalizeTextKey(rawKey);
  const value = normalizeTxtLine(rawValue);

  if (!value) return;

  if (key === "nombre") record.nombre = value;
  else if (key === "edad") record.edad = value;
  else if (key === "cedula") record.cedula = value;
  else if (key === "lugar de nacimiento") record.lugarNacimiento = value;
  else if (key === "nivel de estudio") record.nivelEstudio = value;
  else record[rawKey.trim()] = value;
};

const tieneDatosPersonaTxt = (record = {}) =>
  ["nombre", "edad", "cedula", "lugarNacimiento", "nivelEstudio"].some((key) =>
    !isEmptyValue(record[key])
  );

const parsePostulanteTxt = (content = "") => {
  const lines = String(content)
    .split("\n")
    .map(normalizeTxtLine)
    .filter(Boolean);
  const records = [];
  let current = null;

  lines.forEach((line) => {
    const separatorIndex = line.indexOf(":");

    if (separatorIndex === -1) {
      if (current && tieneDatosPersonaTxt(current)) records.push(clean(current));
      current = parseTxtHeading(line);
      return;
    }

    if (!current) current = parseTxtHeading("TITULAR");

    assignTxtField(
      current,
      line.slice(0, separatorIndex),
      line.slice(separatorIndex + 1),
    );
  });

  if (current && tieneDatosPersonaTxt(current)) records.push(clean(current));

  const titular = records.find((record) => record.tipo === "TITULAR") || null;
  const familiares = records.filter((record) => record.tipo !== "TITULAR");

  return { titular, familiares, registros: records };
};

const extractTxtContent = (body = {}) => {
  if (typeof body === "string") return body;
  if (typeof body?.contenido === "string") return body.contenido;
  if (typeof body?.texto === "string") return body.texto;
  if (typeof body?.txt === "string") return body.txt;
  return "";
};

const createHttpError = (statusCode, code, message) =>
  Object.assign(new Error(message), { statusCode, code });

const cleanTxtFilename = (value) =>
  String(value || "")
    .split(/[\\/]/)
    .pop()
    .trim()
    .slice(0, 255);

const extractCedulaFromTxtFilename = (value) => {
  const filename = cleanTxtFilename(value);
  const match = filename.match(/^consulta_(\d{10})_.+\.txt$/i);
  return match?.[1] || null;
};

const normalizeCedula = (value) => String(value || "").trim();

const parsePositiveInt = (value, fallback, max = Number.MAX_SAFE_INTEGER) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
};

const parseOptionalAge = (value) => {
  if (value === "" || value === null || value === undefined) return null;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 120) return null;

  return parsed;
};

const parseDateOnlyParts = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;

  return { year, month, day };
};

const guayaquilDayStartUtc = (value) => {
  const parts = parseDateOnlyParts(value);
  if (!parts) return null;

  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 5, 0, 0, 0));
};

const guayaquilDayEndUtc = (value) => {
  const parts = parseDateOnlyParts(value);
  if (!parts) return null;

  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 1, 4, 59, 59, 999));
};

const getGuayaquilDate = (now = Date.now()) =>
  new Date(now - GUAYAQUIL_OFFSET_MS).toISOString().slice(0, 10);

const addDaysToDateOnly = (value, days) => {
  const parts = parseDateOnlyParts(value);
  if (!parts) return null;

  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days))
    .toISOString()
    .slice(0, 10);
};

const parseDateRange = ({ fecha, fechaDesde, fechaHasta } = {}) => {
  const desde = fechaDesde || fecha;
  const hasta = fechaHasta || fecha;

  if (!desde && !hasta) return null;

  const start = desde ? guayaquilDayStartUtc(desde) : null;
  const end = hasta ? guayaquilDayEndUtc(hasta) : null;
  const range = {};

  if (start && end && start > end) {
    range[Op.gte] = guayaquilDayStartUtc(hasta);
    range[Op.lte] = guayaquilDayEndUtc(desde);
    return range;
  }

  if (start) range[Op.gte] = start;
  if (end) range[Op.lte] = end;

  return Reflect.ownKeys(range).length ? range : null;
};

const parseInterviewPeriodRange = (value) => {
  const period = String(value || "").toLowerCase();
  const daysByPeriod = new Map([
    ["hoy", 1],
    ["7", 7],
    ["30", 30],
  ]);
  const days = daysByPeriod.get(period);

  if (!days) return null;

  const today = getGuayaquilDate();
  return parseDateRange({
    fechaDesde: today,
    fechaHasta: addDaysToDateOnly(today, days - 1),
  });
};

const buildListWhere = (query = {}) => {
  const where = {};
  const andConditions = [];
  const q = typeof query.q === "string" ? query.q.trim() : "";
  const ciudad = typeof query.ciudad === "string" ? query.ciudad.trim() : "";
  const estado = typeof query.estado === "string" ? query.estado.toLowerCase() : "";
  const fase = typeof query.fase === "string" ? query.fase.toLowerCase() : "";
  const estadoEntrevista = String(query.estadoEntrevista || "").toUpperCase();
  const entrevistadorId = parsePositiveInt(query.entrevistadorId, null);
  const tituloTercerNivel = ["si", "no"].includes(
    String(query.tituloTercerNivel || "").toLowerCase(),
  )
    ? String(query.tituloTercerNivel).toLowerCase()
    : "";
  const estudiaActualmente = ["si", "no"].includes(
    String(query.estudiaActualmente || "").toLowerCase(),
  )
    ? String(query.estudiaActualmente).toLowerCase()
    : "";
  const edadDesde = parseOptionalAge(query.edadDesde);
  const edadHasta = parseOptionalAge(query.edadHasta);
  const noLeidas = String(query.noLeidas || "").toLowerCase() === "true";
  const createdAtRange = parseDateRange(query);
  const interviewDateRange =
    parseInterviewPeriodRange(query.entrevistaPeriodo) ||
    parseDateRange({
      fechaDesde: query.entrevistaFechaDesde,
      fechaHasta: query.entrevistaFechaHasta,
    });

  if (q) {
    where[Op.or] = [
      { nombre: { [Op.iLike]: `%${q}%` } },
      { cedula: { [Op.iLike]: `%${q}%` } },
      { telefono: { [Op.iLike]: `%${q}%` } },
    ];
  }

  if (estado === "leidas") where.leida = true;
  if (estado === "no-leidas" || noLeidas) where.leida = false;
  if (fase === "postulacion") {
    where.pasaEntrevista = false;
    where.descartada = false;
  }
  if (fase === "entrevista") {
    where.pasaEntrevista = true;
    where.descartada = false;
    where.estadoEntrevista =
      INTERVIEW_STATUSES.includes(estadoEntrevista) &&
      !POST_INTERVIEW_STATUSES.includes(estadoEntrevista)
        ? estadoEntrevista
        : { [Op.notIn]: POST_INTERVIEW_STATUSES };
  }
  if (fase === "seleccionado" || fase === "seleccionados") {
    where.pasaEntrevista = true;
    where.descartada = false;
    where.estadoEntrevista = { [Op.in]: SELECTED_INTERVIEW_STATUSES };
  }
  if (fase === "capacitacion") {
    where.pasaEntrevista = true;
    where.descartada = false;
    where.estadoEntrevista = { [Op.in]: TRAINING_INTERVIEW_STATUSES };
  }
  if (fase === "descartado") where.descartada = true;
  if (
    !["entrevista", "seleccionado", "seleccionados", "capacitacion"].includes(fase) &&
    INTERVIEW_STATUSES.includes(estadoEntrevista)
  ) {
    where.estadoEntrevista = estadoEntrevista;
  }
  if (entrevistadorId) where.entrevistadorId = entrevistadorId;
  if (createdAtRange) where.createdAt = createdAtRange;
  if (interviewDateRange) where.fechaEntrevista = interviewDateRange;

  if (ciudad) {
    andConditions.push({
      [Op.or]: [
        sequelizeWhere(json("formulario.datos_personales.ciudadNacimiento"), {
          [Op.iLike]: `%${ciudad}%`,
        }),
        sequelizeWhere(json("formulario.datos_personales.otraCiudadNacimiento"), {
          [Op.iLike]: `%${ciudad}%`,
        }),
      ],
    });
  }

  if (tituloTercerNivel) {
    andConditions.push(
      sequelizeWhere(json("formulario.datos_personales.tieneTituloTercerNivel"), {
        [Op.iLike]: tituloTercerNivel,
      }),
    );
  }

  if (estudiaActualmente) {
    andConditions.push(
      sequelizeWhere(json("formulario.datos_personales.estudiaActualmente"), {
        [Op.iLike]: estudiaActualmente,
      }),
    );
  }

  if (edadDesde !== null || edadHasta !== null) {
    const edadMenor =
      edadDesde !== null && edadHasta !== null
        ? Math.min(edadDesde, edadHasta)
        : edadDesde;
    const edadMayor =
      edadDesde !== null && edadHasta !== null
        ? Math.max(edadDesde, edadHasta)
        : edadHasta;
    const condicionEdad =
      edadMenor !== null && edadMayor !== null
        ? { [Op.between]: [edadMenor, edadMayor] }
        : edadMenor !== null
          ? { [Op.gte]: edadMenor }
          : { [Op.lte]: edadMayor };

    andConditions.push(
      sequelizeWhere(
        literal(`CASE
          WHEN ("formulario"#>>'{datos_personales,edadCumplida}') ~ '^[0-9]+$'
          THEN ("formulario"#>>'{datos_personales,edadCumplida}')::INTEGER
          ELSE NULL
        END`),
        condicionEdad,
      ),
    );
  }

  if (andConditions.length) where[Op.and] = andConditions;

  return where;
};

const buildFromFlatPayload = (data) => ({
  datos_personales: clean({
    nombreCompleto: data.nombreCompleto,
    cedula: data.cedula,
    telefono: data.telefono,
    edadCumplida: data.edadCumplida,
    numeroHijos: data.numeroHijos,
    estadoCivil: data.estadoCivil,
    tieneTituloTercerNivel: data.tieneTituloTercerNivel,
    tituloTercerNivel: data.tituloTercerNivel,
    estudiaActualmente: data.estudiaActualmente,
    queEstudia: data.queEstudia,
    modalidadEstudio: data.modalidadEstudio,
    ciudadNacimiento: data.ciudadNacimiento,
    otraCiudadNacimiento: data.otraCiudadNacimiento,
    direccion: data.direccion,
    provinciaNacimiento: data.provinciaNacimiento,
  }),
  residencia_quito: clean({
    tiempoResidenciaQuito: data.tiempoResidenciaQuito,
    motivoSalidaCiudadNatal: data.motivoSalidaCiudadNatal,
  }),
  vivienda_actual: clean({
    tipoVivienda: data.tipoVivienda,
    viviendaFamiliarQuien: data.viviendaFamiliarQuien,
  }),
  personas_con_quien_vive: [1, 2, 3, 4, 5]
    .map((i) =>
      clean({
        nombre: data[`convive${i}_nombre`],
        telefono: data[`convive${i}_telefono`],
        pariente: data[`convive${i}_pariente`],
        edad: data[`convive${i}_edad`],
        ocupacion: data[`convive${i}_ocupacion`],
        tituloProfesion: data[`convive${i}_tituloProfesion`],
      })
    )
    .filter(tieneDatos),
  historial_laboral: [1, 2, 3, 4, 5]
    .map((i) =>
      clean({
        empresaLugarTrabajo: data[`trabajo${i}_empresa`],
        cargoActividadRealizada: data[`trabajo${i}_cargoActividad`],
        tiempoTrabajado: data[`trabajo${i}_tiempoTrabajado`],
        motivoSalida: data[`trabajo${i}_motivoSalida`],
        jefeEncargado: data[`trabajo${i}_jefeEncargado`],
        telefonoReferencia: data[`trabajo${i}_telefonoReferencia`],
      })
    )
    .filter(tieneDatos),
  observaciones: clean({
    logrosVida: data.logrosVida,
    observacionesAdicionales: data.observacionesAdicionales,
    firmaAspirante: data.firmaAspirante,
    fechaFormulario: data.fechaFormulario,
  }),
});

const normalizePayload = (data = {}) => {
  const structuredPayload = data.datos_personales || data.vivienda_actual || data.historial_laboral;

  const payload = structuredPayload
    ? {
        datos_personales: clean(data.datos_personales),
        residencia_quito: clean(data.residencia_quito),
        vivienda_actual: clean(data.vivienda_actual),
        personas_con_quien_vive: normalizeArray(data.personas_con_quien_vive),
        historial_laboral: normalizeArray(data.historial_laboral),
        observaciones: clean(data.observaciones),
      }
    : buildFromFlatPayload(data);

  payload.metadata = {
    fecha_envio: new Date().toISOString(),
    origen: "web",
    version_formulario: "postulacion-v4",
  };

  return payload;
};

const mergeTxtImportIntoForm = (
  formulario = {},
  parsed,
  importInfo = {},
) => {
  const fechaImportacion = new Date().toISOString();
  const titular = parsed.titular || {};
  const titularImportado = parsed.titular
    ? clean({
        ...parsed.titular,
        limpio: false,
        observacion: "",
      })
    : null;
  const familiares = parsed.familiares.map((familiar) =>
    clean({
      ...familiar,
      limpio: false,
      observacion: "",
    })
  );
  const datosPersonales = clean({
    ...(formulario.datos_personales || {}),
    nombreCompleto: titular.nombre || formulario.datos_personales?.nombreCompleto,
    cedula: titular.cedula || formulario.datos_personales?.cedula,
    edadCumplida: titular.edad || formulario.datos_personales?.edadCumplida,
    lugarNacimiento: titular.lugarNacimiento || formulario.datos_personales?.lugarNacimiento,
    nivelEstudio: titular.nivelEstudio || formulario.datos_personales?.nivelEstudio,
  });

  return {
    ...formulario,
    datos_personales: datosPersonales,
    titular_postulante: titularImportado,
    familiares_postulante: familiares,
    importacion_familiares_txt: clean({
      titular: titularImportado,
      totalFamiliares: familiares.length,
      fechaImportacion,
      origen: "txt",
      nombreArchivo: importInfo.nombreArchivo,
      cedulaArchivo: importInfo.cedulaArchivo,
    }),
    metadata: clean({
      ...(formulario.metadata || {}),
      ultima_importacion_familiares_txt: fechaImportacion,
      ultimo_archivo_familiares_txt: importInfo.nombreArchivo,
    }),
  };
};

const parseAndSaveTxtImport = async ({
  postulacion,
  txtContent,
  nombreArchivo,
  cedulaEsperada,
}) => {
  if (!txtContent.trim()) {
    throw createHttpError(
      400,
      "TXT_VACIO",
      "Debe enviar el contenido del archivo TXT",
    );
  }

  if (Buffer.byteLength(txtContent, "utf8") > MAX_TXT_CONTENT_BYTES) {
    throw createHttpError(
      413,
      "TXT_DEMASIADO_GRANDE",
      "El archivo TXT no puede superar 75 KB.",
    );
  }

  const parsed = parsePostulanteTxt(txtContent);

  if (!parsed.titular && parsed.familiares.length === 0) {
    throw createHttpError(
      422,
      "TXT_SIN_REGISTROS",
      "No se encontraron datos válidos en el archivo TXT",
    );
  }

  const cedulaTitular = normalizeCedula(parsed.titular?.cedula);
  if (
    cedulaEsperada &&
    cedulaTitular &&
    cedulaTitular !== cedulaEsperada
  ) {
    throw createHttpError(
      409,
      "CEDULA_TXT_NO_COINCIDE",
      `La cédula ${cedulaTitular} dentro del TXT no coincide con la cédula ${cedulaEsperada} del nombre del archivo.`,
    );
  }

  const formularioActualizado = mergeTxtImportIntoForm(
    postulacion.formulario || {},
    parsed,
    {
      nombreArchivo: cleanTxtFilename(nombreArchivo),
      cedulaArchivo: cedulaEsperada,
    },
  );

  const datos = formularioActualizado.datos_personales || {};

  postulacion.formulario = formularioActualizado;
  postulacion.nombre =
    datos.nombreCompleto || postulacion.nombre || null;
  postulacion.cedula = datos.cedula || postulacion.cedula || null;
  await postulacion.save();

  return parsed;
};

const obtenerCedulaPostulacion = (postulacion) =>
  normalizeCedula(
    postulacion.cedula ||
      postulacion.formulario?.datos_personales?.cedula,
  );

const agregarDatosIncorporacion = async (postulaciones) => {
  const filas = postulaciones.map((postulacion) =>
    typeof postulacion.toJSON === "function"
      ? postulacion.toJSON()
      : postulacion,
  );
  const cedulas = [
    ...new Set(filas.map(obtenerCedulaPostulacion).filter(Boolean)),
  ];

  if (!cedulas.length) {
    return filas.map((postulacion) => ({
      ...postulacion,
      incorporacion: null,
    }));
  }

  const usuarios = await Usuario.findAll({
    where: { cedula: { [Op.in]: cedulas } },
    attributes: ["id", "cedula", "fechaIngreso"],
  });
  const usuariosPorCedula = new Map(
    usuarios.map((usuario) => [
      normalizeCedula(usuario.cedula),
      usuario,
    ]),
  );
  const usuarioIds = usuarios.map((usuario) => usuario.id);
  const relaciones = usuarioIds.length
    ? await UsuarioAgencia.findAll({
        where: {
          usuarioId: { [Op.in]: usuarioIds },
          activo: true,
        },
        attributes: ["id", "usuarioId", "agenciaId"],
        include: [
          {
            association: "agencia",
            attributes: ["id", "nombre"],
            required: true,
          },
        ],
        order: [
          ["updatedAt", "DESC"],
          ["id", "DESC"],
        ],
      })
    : [];
  const relacionPorUsuario = new Map();

  for (const relacion of relaciones) {
    if (!relacionPorUsuario.has(relacion.usuarioId)) {
      relacionPorUsuario.set(relacion.usuarioId, relacion);
    }
  }

  return filas.map((postulacion) => {
    const usuario = usuariosPorCedula.get(
      obtenerCedulaPostulacion(postulacion),
    );

    if (!usuario) {
      return { ...postulacion, incorporacion: null };
    }

    const relacion = relacionPorUsuario.get(usuario.id);
    return {
      ...postulacion,
      incorporacion: {
        usuarioId: usuario.id,
        fechaIngreso: usuario.fechaIngreso || null,
        agencia: relacion?.agencia
          ? {
              id: relacion.agencia.id,
              nombre: relacion.agencia.nombre,
            }
          : null,
      },
    };
  });
};

const findPostulacionesByCedula = (cedula) =>
  Postulacion.findAll({
    where: {
      [Op.or]: [
        sequelizeWhere(fn("BTRIM", col("cedula")), cedula),
        sequelizeWhere(
          json("formulario.datos_personales.cedula"),
          { [Op.eq]: cedula },
        ),
      ],
    },
    order: [["id", "ASC"]],
    limit: 2,
  });

const buildResumen = async () => {
  const today = getGuayaquilDate();
  const todayStart = guayaquilDayStartUtc(today);
  const todayEnd = guayaquilDayEndUtc(today);
  const nextSevenDaysEnd = new Date(todayEnd.getTime() + 6 * 24 * 60 * 60 * 1000);
  const activeInterviewWhere = {
    pasaEntrevista: true,
    descartada: false,
    estadoEntrevista: { [Op.notIn]: POST_INTERVIEW_STATUSES },
  };

  const [
    totalGeneral,
    total,
    noLeidas,
    entrevistas,
    seleccionados,
    capacitacion,
    descartados,
    pendientesAgendar,
    agendadasHoy,
    porConfirmar,
    reprogramaciones,
  ] = await Promise.all([
    Postulacion.count(),
    Postulacion.count({ where: { pasaEntrevista: false, descartada: false } }),
    Postulacion.count({ where: { leida: false, pasaEntrevista: false, descartada: false } }),
    Postulacion.count({ where: activeInterviewWhere }),
    Postulacion.count({
      where: {
        pasaEntrevista: true,
        descartada: false,
        estadoEntrevista: { [Op.in]: SELECTED_INTERVIEW_STATUSES },
      },
    }),
    Postulacion.count({
      where: {
        pasaEntrevista: true,
        descartada: false,
        estadoEntrevista: { [Op.in]: TRAINING_INTERVIEW_STATUSES },
      },
    }),
    Postulacion.count({ where: { descartada: true } }),
    Postulacion.count({
      where: { ...activeInterviewWhere, fechaEntrevista: null },
    }),
    Postulacion.count({
      where: {
        ...activeInterviewWhere,
        estadoEntrevista: {
          [Op.notIn]: [
            "CANCELADA",
            "NO_ASISTIO",
            "NO_CONTESTO",
            ...POST_INTERVIEW_STATUSES,
          ],
        },
        fechaEntrevista: { [Op.between]: [todayStart, todayEnd] },
      },
    }),
    Postulacion.count({
      where: {
        ...activeInterviewWhere,
        estadoEntrevista: { [Op.in]: ["AGENDADA", "REPROGRAMADA"] },
      },
    }),
    Postulacion.count({
      where: {
        ...activeInterviewWhere,
        estadoEntrevista: "REPROGRAMADA",
        fechaEntrevista: { [Op.between]: [todayStart, nextSevenDaysEnd] },
      },
    }),
  ]);

  return {
    totalGeneral,
    total,
    noLeidas,
    entrevistas,
    seleccionados,
    capacitacion,
    descartados,
    pendientesAgendar,
    agendadasHoy,
    porConfirmar,
    reprogramaciones,
  };
};

const buildDashboardMetrics = async (query = {}) => {
  const createdAtRange = parseDateRange(query);
  const periodWhere = createdAtRange ? { createdAt: createdAtRange } : {};
  const activeInterviewWhere = {
    ...periodWhere,
    pasaEntrevista: true,
    descartada: false,
    estadoEntrevista: { [Op.notIn]: POST_INTERVIEW_STATUSES },
  };

  const [
    postulaciones,
    entrevistas,
    seleccionados,
    capacitacion,
    descartados,
    conTitulo,
    estudiando,
    totalPeriodo,
  ] = await Promise.all([
      Postulacion.count({
        where: {
          ...periodWhere,
          pasaEntrevista: false,
          descartada: false,
        },
      }),
      Postulacion.count({ where: activeInterviewWhere }),
      Postulacion.count({
        where: {
          ...periodWhere,
          pasaEntrevista: true,
          descartada: false,
          estadoEntrevista: { [Op.in]: SELECTED_INTERVIEW_STATUSES },
        },
      }),
      Postulacion.count({
        where: {
          ...periodWhere,
          pasaEntrevista: true,
          descartada: false,
          estadoEntrevista: { [Op.in]: TRAINING_INTERVIEW_STATUSES },
        },
      }),
      Postulacion.count({
        where: { ...periodWhere, descartada: true },
      }),
      Postulacion.count({
        where: {
          ...periodWhere,
          [Op.and]: [
            sequelizeWhere(
              json("formulario.datos_personales.tieneTituloTercerNivel"),
              { [Op.iLike]: "si" },
            ),
          ],
        },
      }),
      Postulacion.count({
        where: {
          ...periodWhere,
          [Op.and]: [
            sequelizeWhere(
              json("formulario.datos_personales.estudiaActualmente"),
              { [Op.iLike]: "si" },
            ),
          ],
        },
      }),
      Postulacion.count({ where: periodWhere }),
    ]);

  return {
    postulaciones,
    entrevistas,
    seleccionados,
    capacitacion,
    descartados,
    conTitulo,
    estudiando,
    totalPeriodo,
  };
};

const validatePayload = (payload) => {
  const errors = [];
  const datos = payload.datos_personales || {};
  const residencia = payload.residencia_quito || {};
  const vivienda = payload.vivienda_actual || {};

  if (!datos.nombreCompleto) errors.push("Nombre completo es obligatorio");
  if (!datos.cedula) errors.push("Cedula es obligatoria");
  if (!datos.telefono) errors.push("Telefono es obligatorio");
  if (!datos.edadCumplida) errors.push("Edad cumplida es obligatoria");
  if (isEmptyValue(datos.numeroHijos)) errors.push("Numero de hijos es obligatorio");
  if (!datos.estadoCivil) errors.push("Estado civil es obligatorio");
  if (!datos.tieneTituloTercerNivel) {
    errors.push("Debe indicar si tiene titulo de tercer nivel");
  }
  if (!datos.estudiaActualmente) {
    errors.push("Debe indicar si estudia actualmente");
  }
  if (!datos.ciudadNacimiento) errors.push("Ciudad de residencia es obligatoria");
  if (datos.ciudadNacimiento === "Otra" && !datos.otraCiudadNacimiento) {
    errors.push("Debe especificar la ciudad de residencia");
  }
  if (!datos.direccion) errors.push("Direccion es obligatoria");
  if (datos.ciudadNacimiento && datos.ciudadNacimiento !== "Quito") {
    if (!residencia.tiempoResidenciaQuito) {
      errors.push("Tiempo de residencia en Quito es obligatorio");
    }
    if (!residencia.motivoSalidaCiudadNatal) {
      errors.push("Motivo de salida de la ciudad natal es obligatorio");
    }
  }
  if (
    String(datos.tieneTituloTercerNivel || "").toLowerCase() === "si" &&
    !datos.tituloTercerNivel
  ) {
    errors.push("Debe especificar el titulo de tercer nivel");
  }
  if (String(datos.estudiaActualmente || "").toLowerCase() === "si") {
    if (!datos.queEstudia) errors.push("Debe especificar que esta estudiando");
    if (!datos.modalidadEstudio) errors.push("Debe especificar la modalidad de estudio");
  }
  if (!vivienda.tipoVivienda) errors.push("Tipo de vivienda es obligatorio");

  return errors;
};

router.post("/", async (req, res) => {
  try {
    const payloadFinal = normalizePayload(req.body);
    const errors = validatePayload(payloadFinal);

    if (errors.length > 0) {
      return res.status(400).json({
        ok: false,
        message: errors.join(". "),
        errors,
      });
    }

    const datos = payloadFinal.datos_personales;
    const postulacion = await Postulacion.create({
      nombre: datos.nombreCompleto || null,
      cedula: datos.cedula || null,
      telefono: datos.telefono || null,
      leida: false,
      formulario: payloadFinal,
    });

    return res.status(201).json({
      ok: true,
      message: "Postulacion guardada",
      id: postulacion.id,
      data: postulacion,
    });
  } catch (error) {
    console.error("Error guardando postulacion:", error);

    return res.status(500).json({
      ok: false,
      message: "Error al guardar postulacion",
      error: error.message,
    });
  }
});

router.get("/resumen", auth, async (_req, res) => {
  try {
    const resumen = await buildResumen();

    return res.json({
      ok: true,
      data: resumen,
    });
  } catch (error) {
    console.error("Error obteniendo resumen de postulaciones:", error);

    return res.status(500).json({
      ok: false,
      message: "Error al obtener resumen de postulaciones",
      error: error.message,
    });
  }
});

router.get("/dashboard", auth, async (req, res) => {
  try {
    const metrics = await buildDashboardMetrics(req.query);

    return res.json({
      ok: true,
      data: metrics,
    });
  } catch (error) {
    console.error("Error obteniendo dashboard de postulaciones:", error);

    return res.status(500).json({
      ok: false,
      message: "Error al obtener el dashboard de postulaciones",
      error: error.message,
    });
  }
});

router.get("/cedulas", auth, async (req, res) => {
  try {
    const rows = await Postulacion.findAll({
      where: buildListWhere(req.query),
      attributes: ["cedula"],
      order: [["createdAt", "DESC"]],
      raw: true,
    });
    const cedulas = [
      ...new Set(
        rows
          .map(({ cedula }) => String(cedula || "").replace(/\D/g, ""))
          .filter((cedula) => /^\d{10}$/.test(cedula)),
      ),
    ];

    return res.json({
      ok: true,
      data: {
        cedulas,
        total: cedulas.length,
      },
    });
  } catch (error) {
    console.error("Error exportando cedulas de postulaciones:", error);

    return res.status(500).json({
      ok: false,
      message: "Error al exportar las cedulas filtradas",
      error: error.message,
    });
  }
});

router.get("/", auth, async (req, res) => {
  try {
    const page = parsePositiveInt(req.query.page, 1);
    const limit = parsePositiveInt(req.query.limit, 10, 100);
    const offset = (page - 1) * limit;
    const where = buildListWhere(req.query);
    const fase = String(req.query.fase || "").toLowerCase();

    const { count, rows } = await Postulacion.findAndCountAll({
      where,
      include: [
        {
          association: "entrevistador",
          attributes: ["id", "nombre", "email"],
          include: [{ association: "rol", attributes: ["id", "nombre"] }],
          required: false,
        },
      ],
      distinct: true,
      order:
        fase === "entrevista"
          ? [
              [literal('"pasaEntrevistaAt" DESC NULLS LAST')],
              ["id", "DESC"],
            ]
          : [["createdAt", "DESC"]],
      limit,
      offset,
    });
    const totalPages = Math.max(Math.ceil(count / limit), 1);
    const data = ["seleccionado", "seleccionados", "capacitacion"].includes(fase)
      ? await agregarDatosIncorporacion(rows)
      : rows;

    return res.json({
      ok: true,
      data,
      pagination: {
        total: count,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("Error obteniendo postulaciones:", error);

    return res.status(500).json({
      ok: false,
      message: "Error al obtener postulaciones",
      error: error.message,
    });
  }
});

router.get("/:id/evaluacion-desempeno", auth, async (req, res) => {
  try {
    const id = parsePositiveInt(req.params.id, null);

    if (!id) {
      return res.status(400).json({
        ok: false,
        message: "El id de la postulacion no es valido.",
      });
    }

    const postulacion = await Postulacion.findByPk(id);

    if (!postulacion) {
      return res.status(404).json({
        ok: false,
        message: "Postulacion no encontrada.",
      });
    }

    if (
      !postulacion.pasaEntrevista ||
      postulacion.descartada ||
      !POST_INTERVIEW_STATUSES.includes(postulacion.estadoEntrevista)
    ) {
      return res.status(409).json({
        ok: false,
        message: "La evaluacion solo esta disponible para postulantes seleccionados.",
      });
    }

    const [postulacionConIncorporacion] = await agregarDatosIncorporacion([
      postulacion,
    ]);

    return res.json({
      ok: true,
      data: {
        postulacion: postulacionConIncorporacion,
        evaluacion:
          postulacionConIncorporacion.formulario?.evaluacion_desempeno || null,
      },
    });
  } catch (error) {
    console.error("Error obteniendo evaluacion de desempeno:", error);

    return res.status(500).json({
      ok: false,
      message: "Error al obtener la evaluacion de desempeno.",
      error: error.message,
    });
  }
});

router.put("/:id/evaluacion-desempeno", auth, async (req, res) => {
  try {
    const id = parsePositiveInt(req.params.id, null);

    if (!id) {
      return res.status(400).json({
        ok: false,
        message: "El id de la postulacion no es valido.",
      });
    }

    const postulacion = await Postulacion.findByPk(id);

    if (!postulacion) {
      return res.status(404).json({
        ok: false,
        message: "Postulacion no encontrada.",
      });
    }

    if (
      !postulacion.pasaEntrevista ||
      postulacion.descartada ||
      !POST_INTERVIEW_STATUSES.includes(postulacion.estadoEntrevista)
    ) {
      return res.status(409).json({
        ok: false,
        message: "La evaluacion solo puede guardarse para postulantes seleccionados.",
      });
    }

    const formulario = postulacion.formulario || {};
    const evaluacion = buildPerformanceEvaluation(
      req.body,
      formulario.evaluacion_desempeno || {},
      req.user || {},
    );

    postulacion.formulario = {
      ...formulario,
      evaluacion_desempeno: evaluacion,
      metadata: {
        ...(formulario.metadata || {}),
        ultima_evaluacion_desempeno: evaluacion.actualizadoAt,
      },
    };
    postulacion.changed("formulario", true);
    await postulacion.save();

    return res.json({
      ok: true,
      message: "Evaluacion de desempeno guardada.",
      data: evaluacion,
    });
  } catch (error) {
    const status = error.statusCode || 500;
    console.error("Error guardando evaluacion de desempeno:", error);

    return res.status(status).json({
      ok: false,
      message:
        status === 500
          ? "Error al guardar la evaluacion de desempeno."
          : error.message,
      ...(status === 500 ? { error: error.message } : {}),
    });
  }
});

router.get("/:id/prueba-capacitacion", auth, async (req, res) => {
  try {
    const id = parsePositiveInt(req.params.id, null);

    if (!id) {
      return res.status(400).json({
        ok: false,
        message: "El id de la postulacion no es valido.",
      });
    }

    const postulacion = await Postulacion.findByPk(id);

    if (!postulacion) {
      return res.status(404).json({
        ok: false,
        message: "Postulacion no encontrada.",
      });
    }

    if (
      !postulacion.pasaEntrevista ||
      postulacion.descartada ||
      postulacion.estadoEntrevista !== "CAPACITACION"
    ) {
      return res.status(409).json({
        ok: false,
        message: "La prueba solo esta disponible para postulantes en capacitacion.",
      });
    }

    const [postulacionConIncorporacion] = await agregarDatosIncorporacion([
      postulacion,
    ]);
    const tipo = typeof req.query?.tipo === "string" ? req.query.tipo : "";

    return res.json({
      ok: true,
      data: {
        postulacion: postulacionConIncorporacion,
        tipos: getTrainingTestTypes(),
        prueba:
          postulacionConIncorporacion.formulario?.prueba_capacitacion || null,
        cuestionario: tipo ? buildTrainingTest(tipo) : null,
      },
    });
  } catch (error) {
    const status = error.statusCode || 500;
    console.error("Error obteniendo prueba de capacitacion:", error);

    return res.status(status).json({
      ok: false,
      message:
        status === 500
          ? "Error al obtener la prueba de capacitacion."
          : error.message,
      ...(status === 500 ? { error: error.message } : {}),
    });
  }
});

router.put("/:id/prueba-capacitacion", auth, async (req, res) => {
  try {
    const id = parsePositiveInt(req.params.id, null);

    if (!id) {
      return res.status(400).json({
        ok: false,
        message: "El id de la postulacion no es valido.",
      });
    }

    const postulacion = await Postulacion.findByPk(id);

    if (!postulacion) {
      return res.status(404).json({
        ok: false,
        message: "Postulacion no encontrada.",
      });
    }

    if (
      !postulacion.pasaEntrevista ||
      postulacion.descartada ||
      postulacion.estadoEntrevista !== "CAPACITACION"
    ) {
      return res.status(409).json({
        ok: false,
        message: "La prueba solo puede guardarse para postulantes en capacitacion.",
      });
    }

    const formulario = postulacion.formulario || {};
    const prueba = gradeTrainingTest(req.body, req.user || {});
    const historial = Array.isArray(formulario.historial_pruebas_capacitacion)
      ? formulario.historial_pruebas_capacitacion.slice(-9)
      : [];

    postulacion.formulario = {
      ...formulario,
      prueba_capacitacion: prueba,
      historial_pruebas_capacitacion: [...historial, prueba],
      metadata: {
        ...(formulario.metadata || {}),
        ultima_prueba_capacitacion: prueba.actualizadoAt,
      },
    };
    postulacion.changed("formulario", true);
    await postulacion.save();

    return res.json({
      ok: true,
      message: "Prueba de capacitacion guardada.",
      data: prueba,
    });
  } catch (error) {
    const status = error.statusCode || 500;
    console.error("Error guardando prueba de capacitacion:", error);

    return res.status(status).json({
      ok: false,
      message:
        status === 500
          ? "Error al guardar la prueba de capacitacion."
          : error.message,
      ...(status === 500 ? { error: error.message } : {}),
    });
  }
});

router.get("/:id/contrato-capacitacion.pdf", auth, async (req, res) => {
  try {
    const id = parsePositiveInt(req.params.id, null);

    if (!id) {
      return res.status(400).json({
        ok: false,
        message: "El id de la postulación no es válido.",
      });
    }

    const postulacion = await Postulacion.findByPk(id);

    if (!postulacion) {
      return res.status(404).json({
        ok: false,
        message: "Postulación no encontrada.",
      });
    }

    if (!postulacion.pasaEntrevista || postulacion.descartada) {
      return res.status(409).json({
        ok: false,
        message:
          "El contrato solo puede generarse para postulantes activos en Entrevistas.",
      });
    }

    const datosPersonales =
      postulacion.formulario?.datos_personales || {};
    const nombreCompleto =
      datosPersonales.nombreCompleto || postulacion.nombre;
    const cedula = datosPersonales.cedula || postulacion.cedula;
    const cedulaNormalizada = normalizeCedula(cedula);
    const usuario = cedulaNormalizada
      ? await Usuario.findOne({
          where: sequelizeWhere(
            fn("BTRIM", col("cedula")),
            cedulaNormalizada,
          ),
          attributes: ["id", "fechaIngreso"],
          order: [["id", "DESC"]],
        })
      : null;

    if (cedulaNormalizada && !usuario) {
      return res.status(422).json({
        ok: false,
        message:
          "Primero debe crear el usuario del postulante para generar el contrato.",
      });
    }

    const pdf = await generarContratoCapacitacionPdf({
      nombreCompleto,
      cedula,
      fechaIngreso: usuario?.fechaIngreso,
    });
    const cedulaArchivo = String(cedula || "")
      .replace(/[^a-zA-Z0-9_-]/g, "")
      .slice(0, 30);
    const filename = `acuerdo-capacitacion-${cedulaArchivo || postulacion.id}.pdf`;

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(pdf.length),
      "Cache-Control": "private, no-store",
    });

    return res.send(pdf);
  } catch (error) {
    const status = error.statusCode || 500;

    if (status >= 500) {
      console.error("Error generando contrato de capacitación:", error);
    }

    return res.status(status).json({
      ok: false,
      message:
        status === 500
          ? "No se pudo generar el contrato de capacitación."
          : error.message,
    });
  }
});

router.patch("/familiares-txt/por-cedula", auth, async (req, res) => {
  try {
    const nombreArchivo = cleanTxtFilename(req.body?.nombreArchivo);
    const cedulaArchivo = extractCedulaFromTxtFilename(nombreArchivo);
    const txtContent = extractTxtContent(req.body);

    if (!cedulaArchivo) {
      return res.status(400).json({
        ok: false,
        code: "NOMBRE_ARCHIVO_INVALIDO",
        message:
          "El archivo debe llamarse consulta_<cedula>_<fecha>_<hora>.txt e incluir una cédula de 10 dígitos.",
      });
    }

    const postulaciones = await findPostulacionesByCedula(cedulaArchivo);

    if (postulaciones.length === 0) {
      return res.status(404).json({
        ok: false,
        code: "POSTULACION_NO_ENCONTRADA",
        message: `No se encontró una postulación con la cédula ${cedulaArchivo}.`,
      });
    }

    if (postulaciones.length > 1) {
      return res.status(409).json({
        ok: false,
        code: "POSTULACION_CEDULA_DUPLICADA",
        message: `Existe más de una postulación con la cédula ${cedulaArchivo}. No se importó el archivo.`,
      });
    }

    const postulacion = postulaciones[0];
    const parsed = await parseAndSaveTxtImport({
      postulacion,
      txtContent,
      nombreArchivo,
      cedulaEsperada: cedulaArchivo,
    });

    return res.json({
      ok: true,
      message: "Información familiar importada correctamente",
      data: {
        postulacionId: postulacion.id,
        nombre: postulacion.nombre,
        cedula: cedulaArchivo,
        nombreArchivo,
        titularImportado: Boolean(parsed.titular),
        totalFamiliares: parsed.familiares.length,
      },
    });
  } catch (error) {
    const status = error.statusCode || 500;

    if (status >= 500) {
      console.error("Error importando TXT masivo por cédula:", error);
    }

    return res.status(status).json({
      ok: false,
      code: error.code,
      message:
        status >= 500
          ? "Error al importar la información familiar desde TXT"
          : error.message,
    });
  }
});

router.patch("/:id/familiares-txt", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const txtContent = extractTxtContent(req.body);
    const postulacion = await Postulacion.findByPk(id);

    if (!postulacion) {
      return res.status(404).json({
        ok: false,
        message: "Postulación no encontrada",
      });
    }

    const parsed = await parseAndSaveTxtImport({
      postulacion,
      txtContent,
      nombreArchivo: req.body?.nombreArchivo,
    });

    return res.json({
      ok: true,
      message: "Información familiar importada correctamente",
      data: postulacion,
      parsed: {
        titular: parsed.titular,
        familiares: parsed.familiares,
      },
    });
  } catch (error) {
    const status = error.statusCode || 500;

    if (status >= 500) {
      console.error("Error importando información familiar desde TXT:", error);
    }

    return res.status(status).json({
      ok: false,
      code: error.code,
      message:
        status >= 500
          ? "Error al importar información familiar desde TXT"
          : error.message,
    });
  }
});

router.patch("/:id/familiares/:familiarIndex", auth, async (req, res) => {
  try {
    const { id, familiarIndex } = req.params;
    const index = Number.parseInt(familiarIndex, 10);

    if (!Number.isInteger(index) || index < 0) {
      return res.status(400).json({
        ok: false,
        message: "Indice de familiar no valido",
      });
    }

    const postulacion = await Postulacion.findByPk(id);

    if (!postulacion) {
      return res.status(404).json({
        ok: false,
        message: "Postulacion no encontrada",
      });
    }

    const formulario = postulacion.formulario || {};
    const familiares = Array.isArray(formulario.familiares_postulante)
      ? [...formulario.familiares_postulante]
      : [];

    if (!familiares[index]) {
      return res.status(404).json({
        ok: false,
        message: "Familiar importado no encontrado",
      });
    }

    const limpio =
      typeof req.body?.limpio === "boolean" ? req.body.limpio : familiares[index].limpio;
    const observacion =
      typeof req.body?.observacion === "string"
        ? req.body.observacion.trim()
        : familiares[index].observacion || "";

    if (observacion.length > 1000) {
      return res.status(400).json({
        ok: false,
        message: "La observacion no puede superar 1000 caracteres",
      });
    }

    familiares[index] = clean({
      ...familiares[index],
      limpio,
      observacion,
    });

    postulacion.formulario = {
      ...formulario,
      familiares_postulante: familiares,
      metadata: clean({
        ...(formulario.metadata || {}),
        ultima_revision_familiar_txt: new Date().toISOString(),
      }),
    };
    postulacion.changed("formulario", true);
    await postulacion.save();

    return res.json({
      ok: true,
      message: "Revision del familiar guardada",
      data: postulacion,
      familiar: familiares[index],
    });
  } catch (error) {
    console.error("Error guardando revision de familiar importado:", error);

    return res.status(500).json({
      ok: false,
      message: "Error al guardar la revision del familiar",
      error: error.message,
    });
  }
});

router.patch("/:id/titular-txt", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const postulacion = await Postulacion.findByPk(id);

    if (!postulacion) {
      return res.status(404).json({
        ok: false,
        message: "Postulacion no encontrada",
      });
    }

    const formulario = postulacion.formulario || {};
    const titular =
      formulario.titular_postulante || formulario.importacion_familiares_txt?.titular;

    if (!titular) {
      return res.status(404).json({
        ok: false,
        message: "Titular importado no encontrado",
      });
    }

    const limpio = typeof req.body?.limpio === "boolean" ? req.body.limpio : titular.limpio;
    const observacion =
      typeof req.body?.observacion === "string"
        ? req.body.observacion.trim()
        : titular.observacion || "";

    if (observacion.length > 1000) {
      return res.status(400).json({
        ok: false,
        message: "La observacion no puede superar 1000 caracteres",
      });
    }

    const titularActualizado = clean({
      ...titular,
      limpio,
      observacion,
    });

    postulacion.formulario = {
      ...formulario,
      titular_postulante: titularActualizado,
      importacion_familiares_txt: clean({
        ...(formulario.importacion_familiares_txt || {}),
        titular: titularActualizado,
      }),
      metadata: clean({
        ...(formulario.metadata || {}),
        ultima_revision_titular_txt: new Date().toISOString(),
      }),
    };
    postulacion.changed("formulario", true);
    await postulacion.save();

    return res.json({
      ok: true,
      message: "Revision del titular guardada",
      data: postulacion,
      titular: titularActualizado,
    });
  } catch (error) {
    console.error("Error guardando revision del titular importado:", error);

    return res.status(500).json({
      ok: false,
      message: "Error al guardar la revision del titular",
      error: error.message,
    });
  }
});

router.patch(
  "/:id/referencias/observacion",
  auth,
  async (req, res) => {
    try {
      const { id } = req.params;

      if (typeof req.body?.observacion !== "string") {
        return res.status(400).json({
          ok: false,
          message: "Debe enviar una observacion",
        });
      }

      const observacion = req.body.observacion.trim();

      if (observacion.length > 1000) {
        return res.status(400).json({
          ok: false,
          message: "La observacion no puede superar 1000 caracteres",
        });
      }

      const postulacion = await Postulacion.findByPk(id);

      if (!postulacion) {
        return res.status(404).json({
          ok: false,
          message: "Postulacion no encontrada",
        });
      }

      const formulario = postulacion.formulario || {};
      postulacion.formulario = {
        ...formulario,
        metadata: {
          ...(formulario.metadata || {}),
          observacion_referencias: observacion,
          ultima_revision_referencias: new Date().toISOString(),
        },
      };
      await postulacion.save();

      return res.json({
        ok: true,
        message: "Observacion general de referencias guardada",
        data: postulacion,
        observacion,
      });
    } catch (error) {
      console.error(
        "Error guardando observacion general de referencias:",
        error,
      );

      return res.status(500).json({
        ok: false,
        message: "Error al guardar la observacion de referencias",
        error: error.message,
      });
    }
  },
);

router.post("/:id/referencias/:tipo", auth, async (req, res) => {
  try {
    const { id, tipo } = req.params;
    const config = REFERENCE_CONFIG[tipo];

    if (!config) {
      return res.status(400).json({
        ok: false,
        message: "El tipo de referencia debe ser familiar o laboral",
      });
    }

    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      return res.status(400).json({
        ok: false,
        message: "La referencia enviada no es valida",
      });
    }

    const reference = buildReference(tipo, req.body);
    const postulacion = await Postulacion.findByPk(id);

    if (!postulacion) {
      return res.status(404).json({
        ok: false,
        message: "Postulacion no encontrada",
      });
    }

    const formulario = postulacion.formulario || {};
    const referencias = Array.isArray(formulario[config.collectionKey])
      ? formulario[config.collectionKey].map((item) => ({ ...item }))
      : [];
    referencias.push(reference);

    postulacion.formulario = {
      ...formulario,
      [config.collectionKey]: referencias,
      metadata: {
        ...(formulario.metadata || {}),
        ultima_revision_referencias: new Date().toISOString(),
      },
    };
    postulacion.changed?.("formulario", true);
    await postulacion.save();

    return res.status(201).json({
      ok: true,
      message: "Referencia agregada correctamente",
      data: postulacion,
      referencia: reference,
      referenciaIndex: referencias.length - 1,
    });
  } catch (error) {
    const status = error.statusCode || 500;
    if (status === 500) {
      console.error("Error agregando referencia:", error);
    }

    return res.status(status).json({
      ok: false,
      message:
        status === 500 ? "Error al agregar la referencia" : error.message,
      ...(status === 500 ? { error: error.message } : {}),
    });
  }
});

router.patch(
  "/:id/referencias/:tipo/:referenciaIndex/llamado",
  auth,
  async (req, res) => {
    try {
      const { id, tipo, referenciaIndex } = req.params;
      const index = Number.parseInt(referenciaIndex, 10);
      const colecciones = {
        familiar: "personas_con_quien_vive",
        laboral: "historial_laboral",
      };
      const collectionKey = colecciones[tipo];

      if (!collectionKey) {
        return res.status(400).json({
          ok: false,
          message: "El tipo de referencia debe ser familiar o laboral",
        });
      }

      if (!Number.isInteger(index) || index < 0) {
        return res.status(400).json({
          ok: false,
          message: "Indice de referencia no valido",
        });
      }

      const llamadoEnviado = typeof req.body?.llamado === "boolean";
      const observacionEnviada = typeof req.body?.observacion === "string";

      if (!llamadoEnviado && !observacionEnviada) {
        return res.status(400).json({
          ok: false,
          message: "Debe enviar el estado llamado o una observacion",
        });
      }

      const observacion = observacionEnviada
        ? req.body.observacion.trim()
        : null;

      if (observacionEnviada && observacion.length > 1000) {
        return res.status(400).json({
          ok: false,
          message: "La observacion no puede superar 1000 caracteres",
        });
      }

      const postulacion = await Postulacion.findByPk(id);

      if (!postulacion) {
        return res.status(404).json({
          ok: false,
          message: "Postulacion no encontrada",
        });
      }

      const formulario = postulacion.formulario || {};
      const referencias = Array.isArray(formulario[collectionKey])
        ? formulario[collectionKey].map((referencia) => ({ ...referencia }))
        : [];

      if (!referencias[index]) {
        return res.status(404).json({
          ok: false,
          message: "Referencia no encontrada",
        });
      }

      referencias[index] = {
        ...referencias[index],
        ...(llamadoEnviado ? { llamado: req.body.llamado } : {}),
        ...(observacionEnviada ? { observacion } : {}),
      };
      postulacion.formulario = {
        ...formulario,
        [collectionKey]: referencias,
        metadata: {
          ...(formulario.metadata || {}),
          ultima_revision_referencias: new Date().toISOString(),
        },
      };
      await postulacion.save();

      return res.json({
        ok: true,
        message: "Revision de referencia guardada",
        data: postulacion,
        referencia: referencias[index],
      });
    } catch (error) {
      console.error("Error guardando estado de llamada de referencia:", error);

      return res.status(500).json({
        ok: false,
        message: "Error al guardar el estado de llamada",
        error: error.message,
      });
    }
  },
);

router.patch("/:id/observacion", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const observacion = typeof req.body?.observacion === "string" ? req.body.observacion.trim() : "";

    const postulacion = await Postulacion.findByPk(id);

    if (!postulacion) {
      return res.status(404).json({
        ok: false,
        message: "Postulacion no encontrada",
      });
    }

    postulacion.observacion = observacion || null;
    await postulacion.save();

    return res.json({
      ok: true,
      message: "Observacion guardada",
      data: postulacion,
    });
  } catch (error) {
    console.error("Error guardando observacion de postulacion:", error);

    return res.status(500).json({
      ok: false,
      message: "Error al guardar la observacion",
      error: error.message,
    });
  }
});

router.patch("/:id/entrevista", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { pasaEntrevista } = req.body || {};

    if (typeof pasaEntrevista !== "boolean") {
      return res.status(400).json({
        ok: false,
        message: "El estado de entrevista debe ser verdadero o falso",
      });
    }

    const postulacion = await Postulacion.findByPk(id);

    if (!postulacion) {
      return res.status(404).json({
        ok: false,
        message: "Postulacion no encontrada",
      });
    }

    if (postulacion.descartada) {
      return res.status(400).json({
        ok: false,
        message: "Debe restaurar al postulante antes de cambiarlo de fase",
      });
    }

    postulacion.pasaEntrevista = pasaEntrevista;
    postulacion.pasaEntrevistaAt = pasaEntrevista ? new Date() : null;
    await postulacion.save();

    const resumen = await buildResumen();

    return res.json({
      ok: true,
      message: pasaEntrevista
        ? "Postulante movido a entrevistas"
        : "Postulante devuelto a postulaciones",
      data: postulacion,
      resumen,
    });
  } catch (error) {
    console.error("Error actualizando la fase de la postulacion:", error);

    return res.status(500).json({
      ok: false,
      message: "Error al actualizar la fase de la postulacion",
      error: error.message,
    });
  }
});

router.patch("/:id/fecha-entrevista", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      fechaEntrevista: rawFechaEntrevista,
      entrevistadorId,
      modalidad,
      lugar,
      enlace,
      observaciones,
    } = req.body || {};

    if (rawFechaEntrevista === undefined) {
      return res.status(400).json({
        ok: false,
        message: "Debe enviar la fecha y hora de la entrevista",
      });
    }

    let fechaEntrevista = null;

    if (rawFechaEntrevista !== null && rawFechaEntrevista !== "") {
      fechaEntrevista = new Date(rawFechaEntrevista);

      if (Number.isNaN(fechaEntrevista.getTime())) {
        return res.status(400).json({
          ok: false,
          message: "La fecha y hora de la entrevista no son validas",
        });
      }
    }

    const postulacion = await Postulacion.findByPk(id);

    if (!postulacion) {
      return res.status(404).json({
        ok: false,
        message: "Postulacion no encontrada",
      });
    }

    if (!postulacion.pasaEntrevista || postulacion.descartada) {
      return res.status(400).json({
        ok: false,
        message: "Solo se puede agendar a un postulante que se encuentre en Entrevistas",
      });
    }

    const fullSchedulePayload =
      entrevistadorId !== undefined ||
      modalidad !== undefined ||
      lugar !== undefined ||
      enlace !== undefined ||
      observaciones !== undefined;
    const interviewerFieldProvided = Object.prototype.hasOwnProperty.call(
      req.body || {},
      "entrevistadorId",
    );
    const interviewerIdProvided =
      interviewerFieldProvided && entrevistadorId !== null && entrevistadorId !== "";

    if (fechaEntrevista && fechaEntrevista.getTime() < Date.now() - 60 * 1000) {
      return res.status(400).json({
        ok: false,
        message: "La entrevista no puede agendarse en una fecha anterior",
      });
    }

    let interviewer = null;
    let normalizedModality = null;
    let normalizedLocation = null;
    let normalizedLink = null;
    let normalizedObservations = null;

    if (fechaEntrevista && fullSchedulePayload) {
      normalizedModality = String(modalidad || "").toUpperCase();
      normalizedLocation = typeof lugar === "string" ? lugar.trim() : "";
      normalizedLink = typeof enlace === "string" ? enlace.trim() : "";
      normalizedObservations =
        typeof observaciones === "string" ? observaciones.trim() : "";

      if (!INTERVIEW_MODALITIES.includes(normalizedModality)) {
        return res.status(400).json({
          ok: false,
          message: "La modalidad debe ser presencial o virtual",
        });
      }

      if (normalizedModality === "PRESENCIAL" && !normalizedLocation) {
        return res.status(400).json({
          ok: false,
          message: "El lugar es obligatorio para una entrevista presencial",
        });
      }

      if (normalizedModality === "VIRTUAL") {
        try {
          const meetingUrl = new URL(normalizedLink);
          if (!["http:", "https:"].includes(meetingUrl.protocol)) throw new Error();
        } catch {
          return res.status(400).json({
            ok: false,
            message: "Debe ingresar un enlace valido para la entrevista virtual",
          });
        }
      }

      if (normalizedObservations.length > 1000) {
        return res.status(400).json({
          ok: false,
          message: "Las observaciones no pueden superar 1000 caracteres",
        });
      }

      if (interviewerIdProvided) {
        interviewer = await Usuario.findOne({
          where: { id: entrevistadorId, activo: true },
        });

        if (!interviewer) {
          return res.status(400).json({
            ok: false,
            message: "El entrevistador seleccionado no esta activo",
          });
        }

        const proposedStart = fechaEntrevista.getTime();
        const proposedEnd = proposedStart + 45 * 60 * 1000;
        const possibleConflicts = await Postulacion.findAll({
          where: {
            id: { [Op.ne]: postulacion.id },
            pasaEntrevista: true,
            descartada: false,
            entrevistadorId: interviewer.id,
            estadoEntrevista: { [Op.in]: ACTIVE_INTERVIEW_STATUSES },
            fechaEntrevista: {
              [Op.gt]: new Date(proposedStart - 60 * 60 * 1000),
              [Op.lt]: new Date(proposedEnd),
            },
          },
          attributes: ["id", "fechaEntrevista", "entrevistaDuracionMinutos"],
        });
        const conflict = possibleConflicts.some((item) => {
          const existingStart = new Date(item.fechaEntrevista).getTime();
          const existingDuration = item.entrevistaDuracionMinutos || 45;
          const existingEnd = existingStart + existingDuration * 60 * 1000;
          return existingStart < proposedEnd && existingEnd > proposedStart;
        });

        if (conflict) {
          return res.status(409).json({
            ok: false,
            code: "INTERVIEW_SCHEDULE_CONFLICT",
            message: "El entrevistador ya tiene otra entrevista en ese horario",
          });
        }
      }
    }

    const previousInterviewDate = postulacion.fechaEntrevista
      ? new Date(postulacion.fechaEntrevista).getTime()
      : null;
    const scheduleChanged = Boolean(
      previousInterviewDate &&
        fechaEntrevista &&
        previousInterviewDate !== fechaEntrevista.getTime(),
    );

    postulacion.fechaEntrevista = fechaEntrevista;
    postulacion.estadoEntrevista = fechaEntrevista
      ? scheduleChanged
        ? "REPROGRAMADA"
        : previousInterviewDate
          ? postulacion.estadoEntrevista || "AGENDADA"
          : "AGENDADA"
      : "PENDIENTE";

    if (scheduleChanged) {
      postulacion.entrevistaReprogramaciones =
        Number(postulacion.entrevistaReprogramaciones || 0) + 1;
    }

    if (fullSchedulePayload) {
      postulacion.entrevistaDuracionMinutos = null;
      if (interviewerFieldProvided) {
        postulacion.entrevistadorId = fechaEntrevista ? interviewer?.id || null : null;
      }
      postulacion.entrevistaModalidad = fechaEntrevista ? normalizedModality : null;
      postulacion.entrevistaLugar =
        fechaEntrevista && normalizedModality === "PRESENCIAL" ? normalizedLocation : null;
      postulacion.entrevistaEnlace =
        fechaEntrevista && normalizedModality === "VIRTUAL" ? normalizedLink : null;
      postulacion.entrevistaObservaciones = fechaEntrevista
        ? normalizedObservations || null
        : null;
    }
    await postulacion.save();

    const updatedPostulacion = await Postulacion.findByPk(postulacion.id, {
      include: [
        {
          association: "entrevistador",
          attributes: ["id", "nombre", "email"],
          include: [{ association: "rol", attributes: ["id", "nombre"] }],
          required: false,
        },
      ],
    });

    return res.json({
      ok: true,
      message: fechaEntrevista
        ? "Fecha y hora de entrevista guardadas"
        : "Fecha y hora de entrevista eliminadas",
      data: updatedPostulacion,
    });
  } catch (error) {
    console.error("Error guardando la fecha de entrevista:", error);

    return res.status(500).json({
      ok: false,
      message: "Error al guardar la fecha y hora de la entrevista",
      error: error.message,
    });
  }
});

router.patch("/:id/estado-entrevista", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const estadoEntrevista = String(req.body?.estadoEntrevista || "").toUpperCase();

    if (!INTERVIEW_STATUSES.includes(estadoEntrevista)) {
      return res.status(400).json({
        ok: false,
        message: "El estado de entrevista no es valido",
      });
    }

    const postulacion = await Postulacion.findByPk(id);

    if (!postulacion) {
      return res.status(404).json({
        ok: false,
        message: "Postulacion no encontrada",
      });
    }

    if (!postulacion.pasaEntrevista || postulacion.descartada) {
      return res.status(400).json({
        ok: false,
        message: "El postulante no se encuentra en la seccion Entrevistas",
      });
    }

    if (
      !["PENDIENTE", "NO_CONTESTO"].includes(estadoEntrevista) &&
      !postulacion.fechaEntrevista
    ) {
      return res.status(400).json({
        ok: false,
        message: "Debe agendar la entrevista antes de cambiar su estado",
      });
    }

    postulacion.estadoEntrevista = estadoEntrevista;
    await postulacion.save();

    const resumen = await buildResumen();

    return res.json({
      ok: true,
      message: "Estado de entrevista actualizado",
      data: postulacion,
      resumen,
    });
  } catch (error) {
    console.error("Error actualizando el estado de entrevista:", error);

    return res.status(500).json({
      ok: false,
      message: "Error al actualizar el estado de entrevista",
      error: error.message,
    });
  }
});

router.patch("/:id/descartada", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { descartada } = req.body || {};
    const motivoDescarte =
      typeof req.body?.motivoDescarte === "string"
        ? req.body.motivoDescarte.trim()
        : typeof req.body?.observacion === "string"
          ? req.body.observacion.trim()
          : "";

    if (typeof descartada !== "boolean") {
      return res.status(400).json({
        ok: false,
        message: "El estado de descarte debe ser verdadero o falso",
      });
    }

    if (descartada && !motivoDescarte) {
      return res.status(400).json({
        ok: false,
        message: "Debe ingresar el motivo por el que descarta al postulante",
      });
    }

    if (motivoDescarte.length > 1000) {
      return res.status(400).json({
        ok: false,
        message: "El motivo del descarte no puede superar 1000 caracteres",
      });
    }

    const postulacion = await Postulacion.findByPk(id);

    if (!postulacion) {
      return res.status(404).json({
        ok: false,
        message: "Postulacion no encontrada",
      });
    }

    postulacion.descartada = descartada;
    postulacion.descartadaAt = descartada ? new Date() : null;

    if (descartada) {
      const formulario = postulacion.formulario || {};
      postulacion.formulario = {
        ...formulario,
        metadata: {
          ...(formulario.metadata || {}),
          motivo_descarte: motivoDescarte,
          motivo_descarte_at: new Date().toISOString(),
        },
      };
      postulacion.changed("formulario", true);
    }

    await postulacion.save();

    const resumen = await buildResumen();

    return res.json({
      ok: true,
      message: descartada ? "Postulante enviado a Descartados" : "Postulante restaurado",
      data: postulacion,
      resumen,
    });
  } catch (error) {
    console.error("Error actualizando el descarte de la postulacion:", error);

    return res.status(500).json({
      ok: false,
      message: "Error al actualizar el descarte de la postulacion",
      error: error.message,
    });
  }
});

router.patch("/:id/leida", auth, async (req, res) => {
  try {
    const { id } = req.params;

    const postulacion = await Postulacion.findByPk(id);

    if (!postulacion) {
      return res.status(404).json({
        ok: false,
        message: "Postulacion no encontrada",
      });
    }

    if (!postulacion.leida) {
      postulacion.leida = true;
      postulacion.leidaAt = new Date();
      await postulacion.save();
    }

    const resumen = await buildResumen();

    return res.json({
      ok: true,
      message: "Postulacion marcada como leida",
      data: postulacion,
      resumen,
    });
  } catch (error) {
    console.error("Error marcando postulacion como leida:", error);

    return res.status(500).json({
      ok: false,
      message: "Error al marcar la postulacion como leida",
      error: error.message,
    });
  }
});

router.get("/cedula/:cedula", auth, async (req, res) => {
  try {
    const { cedula } = req.params;

    const postulacion = await Postulacion.findOne({
      where: { cedula },
    });

    if (!postulacion) {
      return res.status(404).json({
        ok: false,
        message: "Postulacion no encontrada",
      });
    }

    return res.json({
      ok: true,
      data: postulacion,
    });
  } catch (error) {
    console.error("Error buscando postulacion por cedula:", error);

    return res.status(500).json({
      ok: false,
      message: "Error al buscar postulacion",
      error: error.message,
    });
  }
});

router.delete("/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;

    const postulacion = await Postulacion.findByPk(id);

    if (!postulacion) {
      return res.status(404).json({
        ok: false,
        message: "Postulacion no encontrada",
      });
    }

    await postulacion.destroy();

    return res.json({
      ok: true,
      message: "Postulacion eliminada",
      id: Number(id),
    });
  } catch (error) {
    console.error("Error eliminando postulacion:", error);

    return res.status(500).json({
      ok: false,
      message: "Error al eliminar postulacion",
      error: error.message,
    });
  }
});

module.exports = router;
