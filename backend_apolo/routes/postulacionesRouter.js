const express = require("express");
const { Op } = require("sequelize");

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
  const q = typeof query.q === "string" ? query.q.trim() : "";
  const estado = typeof query.estado === "string" ? query.estado.toLowerCase() : "";
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
  if (createdAtRange) where.createdAt = createdAtRange;

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
        vivienda_actual: clean({
          tipoVivienda: data.vivienda_actual?.tipoVivienda,
          viviendaFamiliarQuien: data.vivienda_actual?.viviendaFamiliarQuien,
        }),
        personas_con_quien_vive: normalizeArray(data.personas_con_quien_vive),
        historial_laboral: normalizeArray(data.historial_laboral),
        observaciones: clean({
          logrosVida: data.observaciones?.logrosVida,
          observacionesAdicionales: data.observaciones?.observacionesAdicionales,
          firmaAspirante: data.observaciones?.firmaAspirante,
          fechaFormulario: data.observaciones?.fechaFormulario,
        }),
      }
    : buildFromFlatPayload(data);

  payload.metadata = {
    fecha_envio: new Date().toISOString(),
    origen: "web",
    version_formulario: "postulacion-v3",
  };

  return payload;
};

const buildResumen = async () => {
  const [total, noLeidas] = await Promise.all([
    Postulacion.count(),
    Postulacion.count({ where: { leida: false } }),
  ]);

  return { total, noLeidas };
};

const validatePayload = (payload) => {
  const errors = [];
  const datos = payload.datos_personales || {};
  const vivienda = payload.vivienda_actual || {};

  if (!datos.nombreCompleto) errors.push("Nombre completo es obligatorio");
  if (!datos.cedula) errors.push("Cedula es obligatoria");
  if (!datos.edadCumplida) errors.push("Edad cumplida es obligatoria");
  if (!datos.ciudadNacimiento) errors.push("Ciudad de nacimiento es obligatoria");
  if (datos.ciudadNacimiento === "Otra" && !datos.otraCiudadNacimiento) {
    errors.push("Debe especificar la ciudad de nacimiento");
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
