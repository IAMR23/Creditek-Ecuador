const express = require("express");
const router = express.Router();

const Postulacion = require("../../models/Postulacion");  


router.post("/", async (req, res) => {
  try {
    const data = req.body;

    const clean = (obj) =>
      Object.fromEntries(
        Object.entries(obj).filter(([_, v]) => v !== "" && v !== null)
      );

    // =========================
    // DATOS PERSONALES
    // =========================
    const datos_personales = clean({
      nombre: data.nombre,
      cedula: data.cedula,
      genero: data.genero,
      edad: data.edad,
      telefono: data.telefono,
      direccion: data.direccion,
      estadoCivil: data.estadoCivil,
      vivienda: data.vivienda,
      estudios: data.estudios,
      hijos: data.hijos,
    });

    // =========================
    // EXPERIENCIA LABORAL
    // =========================
    const experiencia_laboral = clean({
      trabajo1: clean({
        lugar: data.trabajo1_lugar,
        cargo: data.trabajo1_cargo,
        inicio: data.trabajo1_inicio,
        salida: data.trabajo1_salida,
        razon: data.trabajo1_razon,
        jefe: data.trabajo1_jefe,
        telefono: data.trabajo1_telefono,
      }),
      trabajo2: clean({
        lugar: data.trabajo2_lugar,
        cargo: data.trabajo2_cargo,
        inicio: data.trabajo2_inicio,
        salida: data.trabajo2_salida,
        razon: data.trabajo2_razon,
        jefe: data.trabajo2_jefe,
        telefono: data.trabajo2_telefono,
      }),
      trabajo3: clean({
        lugar: data.trabajo3_lugar,
        cargo: data.trabajo3_cargo,
        inicio: data.trabajo3_inicio,
        salida: data.trabajo3_salida,
        razon: data.trabajo3_razon,
        jefe: data.trabajo3_jefe,
        telefono: data.trabajo3_telefono,
      }),
    });

    // =========================
    // EVALUACIÓN
    // =========================
    const evaluacion = clean({
      planificacion_semanal: data.planificacion_semanal,
      mejora_rendimiento: data.mejora_rendimiento,
      seguimiento_clientes: data.seguimiento_clientes,
      estrategia_mas_ventas: data.estrategia_mas_ventas,
      indicadores_productividad: data.indicadores_productividad,
      producto_final_valioso: data.producto_final_valioso,
      vision_1_ano: data.vision_1_ano,
      vision_5_anos: data.vision_5_anos,
      jefe_favorito: data.jefe_favorito,
      jefe_menos_favorito: data.jefe_menos_favorito,
    });

    // =========================
    // METADATA
    // =========================
    const metadata = {
      fecha_envio: new Date().toISOString(),
      origen: "web",
      version_formulario: "v1",
    };

    // =========================
    // PAYLOAD FINAL
    // =========================
    const payloadFinal = {
      datos_personales,
      experiencia_laboral,
      evaluacion,
      metadata,
    };

    // =========================
    // GUARDAR EN DB
    // =========================
    const postulacion = await Postulacion.create({
      nombre: datos_personales.nombre ?? null,
      cedula: datos_personales.cedula ?? null,
      telefono: datos_personales.telefono ?? null,
      formulario: payloadFinal, // JSONB directo
    });

    res.status(201).json({
      ok: true,
      message: "Postulación guardada",
      id: postulacion.id,
    });
  } catch (error) {
    console.error("Error guardando postulación:", error);
    res.status(500).json({
      ok: false,
      message: "Error al guardar postulación",
    });
  }
});



router.get("/", async (req, res) => {
  try {
    const postulaciones = await Postulacion.findAll({
      order: [["createdAt", "DESC"]],
    });

    res.json({
      ok: true,
      data: postulaciones,
    });

  } catch (error) {
    console.error("Error obteniendo postulaciones:", error);
    res.status(500).json({
      ok: false,
      message: "Error al obtener postulaciones",
    });
  }
});



router.get("/cedula/:cedula", async (req, res) => {
  try {
    const { cedula } = req.params;

    const postulacion = await Postulacion.findOne({
      where: { cedula },
    });

    if (!postulacion) {
      return res.status(404).json({
        ok: false,
        message: "Postulación no encontrada",
      });
    }

    res.json({
      ok: true,
      data: postulacion,
    });

  } catch (error) {
    console.error("Error buscando postulación por cédula:", error);
    res.status(500).json({
      ok: false,
      message: "Error al buscar postulación",
    });
  }
});


module.exports = router;
 