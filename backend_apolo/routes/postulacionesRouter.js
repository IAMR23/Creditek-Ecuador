const express = require("express");

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

const buildFromFlatPayload = (data) => ({
  datos_personales: clean({
    nombreCompleto: data.nombreCompleto,
    cedula: data.cedula,
    edadCumplida: data.edadCumplida,
    numeroHijos: data.numeroHijos,
    estadoCivil: data.estadoCivil,
    ciudadNacimiento: data.ciudadNacimiento,
    otraCiudadNacimiento: data.otraCiudadNacimiento,
    provinciaNacimiento: data.provinciaNacimiento,
  }),
  residencia_quito: clean({
    tiempoResidenciaQuito: data.tiempoResidenciaQuito,
    motivoSalidaCiudadNatal: data.motivoSalidaCiudadNatal,
  }),
  vivienda_actual: clean({
    tipoVivienda: data.tipoVivienda,
    viviendaFamiliarQuien: data.viviendaFamiliarQuien,
    viviendaPrestadaQuien: data.viviendaPrestadaQuien,
    viviendaOtraEspecifique: data.viviendaOtraEspecifique,
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
    sinExperienciaLaboral: data.sinExperienciaLaboral,
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
  const observaciones = payload.observaciones || {};

  if (!datos.nombreCompleto) errors.push("Nombre completo es obligatorio");
  if (!datos.cedula) errors.push("Cedula es obligatoria");
  if (!datos.edadCumplida) errors.push("Edad cumplida es obligatoria");
  if (!datos.ciudadNacimiento) errors.push("Ciudad de nacimiento es obligatoria");
  if (datos.ciudadNacimiento === "Otra" && !datos.otraCiudadNacimiento) {
    errors.push("Debe especificar la ciudad de nacimiento");
  }
  if (!vivienda.tipoVivienda) errors.push("Tipo de vivienda es obligatorio");

  const sinExperiencia = String(observaciones.sinExperienciaLaboral || "").toLowerCase() === "si";
  if (!sinExperiencia && payload.historial_laboral.length === 0) {
    errors.push("Debe registrar al menos una experiencia laboral o indicar que no tiene experiencia");
  }

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

router.get("/", auth, async (_req, res) => {
  try {
    const postulaciones = await Postulacion.findAll({
      order: [["createdAt", "DESC"]],
    });

    return res.json({
      ok: true,
      data: postulaciones,
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
