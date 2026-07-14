const express = require("express");
const { Op, json, literal, where: sequelizeWhere } = require("sequelize");

const Postulacion = require("../models/Postulacion");
const auth = require("../middleware/auth");

const router = express.Router();

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

const normalizeArray = (value) => (Array.isArray(value) ? value.map(clean).filter(tieneDatos) : []);

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

  return Object.keys(range).length ? range : null;
};

const buildListWhere = (query = {}) => {
  const where = {};
  const andConditions = [];
  const q = typeof query.q === "string" ? query.q.trim() : "";
  const ciudad = typeof query.ciudad === "string" ? query.ciudad.trim() : "";
  const estado = typeof query.estado === "string" ? query.estado.toLowerCase() : "";
  const fase = typeof query.fase === "string" ? query.fase.toLowerCase() : "";
  const tituloTercerNivel = ["si", "no"].includes(
    String(query.tituloTercerNivel || "").toLowerCase(),
  )
    ? String(query.tituloTercerNivel).toLowerCase()
    : "";
  const edadDesde = parseOptionalAge(query.edadDesde);
  const edadHasta = parseOptionalAge(query.edadHasta);
  const noLeidas = String(query.noLeidas || "").toLowerCase() === "true";
  const createdAtRange = parseDateRange(query);

  if (q) {
    where[Op.or] = [
      { nombre: { [Op.iLike]: `%${q}%` } },
      { cedula: { [Op.iLike]: `%${q}%` } },
      { telefono: { [Op.iLike]: `%${q}%` } },
    ];
  }

  if (estado === "leidas") where.leida = true;
  if (estado === "no-leidas" || noLeidas) where.leida = false;
  if (fase === "postulacion") where.pasaEntrevista = false;
  if (fase === "entrevista") where.pasaEntrevista = true;
  if (createdAtRange) where.createdAt = createdAtRange;

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

const buildResumen = async () => {
  const [totalGeneral, total, noLeidas, entrevistas] = await Promise.all([
    Postulacion.count(),
    Postulacion.count({ where: { pasaEntrevista: false } }),
    Postulacion.count({ where: { leida: false, pasaEntrevista: false } }),
    Postulacion.count({ where: { pasaEntrevista: true } }),
  ]);

  return { totalGeneral, total, noLeidas, entrevistas };
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
  if (!datos.ciudadNacimiento) errors.push("Ciudad de nacimiento es obligatoria");
  if (datos.ciudadNacimiento === "Otra" && !datos.otraCiudadNacimiento) {
    errors.push("Debe especificar la ciudad de nacimiento");
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

router.get("/", auth, async (req, res) => {
  try {
    const page = parsePositiveInt(req.query.page, 1);
    const limit = parsePositiveInt(req.query.limit, 10, 100);
    const offset = (page - 1) * limit;
    const where = buildListWhere(req.query);

    const { count, rows } = await Postulacion.findAndCountAll({
      where,
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });
    const totalPages = Math.max(Math.ceil(count / limit), 1);

    return res.json({
      ok: true,
      data: rows,
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
