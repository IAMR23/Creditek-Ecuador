const express = require("express");
const router = express.Router();

const Gestion = require("../../models/Gestion");
const UsuarioAgencia = require("../../models/UsuarioAgencia");
const Dispositivo = require("../../models/Dispositivo");
const { Op, Sequelize } = require("sequelize");
const Usuario = require("../../models/Usuario");
const Agencia = require("../../models/Agencia");
const OrigenCallCenter = require("../../models/CallCenter/origenes");

router.post("/", async (req, res) => {
  try {
    const {
      usuarioAgenciaId,
      celularGestionado,
      cedulaGestionado,
      extension,
      dispositivoId,
      solicitud,
      origen,
      region,
      accion,
      observacion,
      origenCallCenter , 
      otrasCedulas,
    } = req.body;

    if (!usuarioAgenciaId || !celularGestionado) {
      return res.status(400).json({
        message: "Campos obligatorios faltantes",
      });
    }

    let otrasCedulasValidadas = null;

    if (accion === "OTRA_CEDULA") {
      if (!Array.isArray(otrasCedulas)) {
        return res.status(400).json({
          message: "otrasCedulas debe ser un arreglo",
        });
      }

      for (const item of otrasCedulas) {
        if (!item.cedula || !item.solicitud) {
          return res.status(400).json({
            message: "Cada cédula debe tener cedula y solicitud",
          });
        }

        if (!["APROBADO", "DENEGADO"].includes(item.solicitud)) {
          return res.status(400).json({
            message:
              "La solicitud en otrasCedulas debe ser APROBADO o DENEGADO",
          });
        }
      }

      otrasCedulasValidadas = otrasCedulas;
    }

    // Normalizar region
    let regionNormalizada = "SIN_ESPECIFICAR";

    if (region && region.trim() !== "") {
      regionNormalizada = region.trim();
    }

    // Normalizar solicitud
    let solicitudNormalizada = "NINGUNA";

    if (solicitud && solicitud.trim() !== "") {
      solicitudNormalizada = solicitud.trim();
    }

    const nuevaGestion = await Gestion.create({
      usuarioAgenciaId,
      celularGestionado,
      cedulaGestionado,
      extension,
      dispositivoId,
      solicitud: solicitudNormalizada,
      origen,
      region: regionNormalizada,
      accion,
      observacion,
      origenCallCenter , 
      otrasCedulas: otrasCedulasValidadas,
    });

    return res.status(201).json(nuevaGestion);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Error al crear la gestión",
      error: error.message,
    });
  }
});

router.post("/origen-callcenter", async (req, res) => {
  try {
    const { nombre, activa } = req.body;

    // Validación básica
    if (!nombre) {
      return res.status(400).json({
        message: "Nombre es obligatorio",
      });
    }

    const nuevoOrigen = await OrigenCallCenter.create({
      nombre,
      activa: activa ?? true,
    });

    res.status(201).json(nuevoOrigen);
  } catch (error) {
    console.error("Error al crear origen:", error);
    res.status(500).json({
      message: "Error al crear origen",
    });
  }
});

// ✅ GET - listar todos
router.get("/origen-callcenter", async (req, res) => {
  try {
    const origenes = await OrigenCallCenter.findAll({
      order: [["id", "DESC"]],
    });

    res.json(origenes);
  } catch (error) {
    console.error("Error al obtener origenes:", error);
    res.status(500).json({
      message: "Error al obtener origenes",
    });
  }
});


router.get("/vendedor/:id", async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query;
    const { id } = req.params;
    if (!fechaInicio || !fechaFin) {
      return res.status(400).json({
        ok: false,
        message: "Debe enviar fechaInicio y fechaFin",
      });
    }

    const gestiones = await Gestion.findAll({
      where: {
        usuarioAgenciaId: id,
        createdAt: {
          [Op.between]: [
            new Date(`${fechaInicio} 00:00:00`),
            new Date(`${fechaFin} 23:59:59`),
          ],
        },
      },
      include: [
        {
          model: UsuarioAgencia,
          as: "usuarioAgencia",
        },
        {
          model: Dispositivo,
          as: "dispositivo",
          attributes: ["id", "nombre"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    return res.json({
      ok: true,
      total: gestiones.length,
      gestiones,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      ok: false,
      message: "Error al generar reporte de gestiones",
      error: error.message,
    });
  }
});



router.get("/", async (req, res) => {
  try {
    const { fechaInicio, fechaFin, solicitud, origen, region , agenciaId} = req.query;
    const where = {};

    if (fechaInicio && fechaFin) {
      const inicio = new Date(fechaInicio);
      const fin = new Date(fechaFin);
      fin.setDate(fin.getDate() + 1);

      where.createdAt = {
        [Op.gte]: inicio,
        [Op.lt]: fin,
      };
    }

    if (solicitud) {
      where[Op.or] = [
        {
          solicitud: solicitud.toUpperCase(),
        },
        Sequelize.literal(`
      EXISTS (
        SELECT 1
FROM jsonb_array_elements("Gestion"."otrasCedulas"::jsonb) AS elem
        WHERE elem->>'solicitud' = '${solicitud.toUpperCase()}'
      )
    `),
      ];
    }

    // Filtro por origen
    if (origen) {
      where.origen = origen.toUpperCase();
    }

    // Filtro por región
    if (region) {
      where.region = region.toUpperCase();
    }

    const gestiones = await Gestion.findAll({
      where,
      include: [
        {
  model: UsuarioAgencia,
  as: "usuarioAgencia",
  attributes: ["id"],
  required: agenciaId ? true : false,
  where: agenciaId ? { agenciaId: Number(agenciaId) } : undefined,
  include: [
    {
      model: Usuario,
      as: "usuario",
      attributes: ["id", "nombre"],
    },
    {
      model: Agencia,
      as: "agencia",
      attributes: ["id", "nombre"],
    },
  ],
}
,
        {
          model: Dispositivo,
          as: "dispositivo",
          attributes: ["id", "nombre"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    return res.json(gestiones);
  } catch (error) {
    return res.status(500).json({
      message: "Error al obtener gestiones",
      error: error.message,
    });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const gestion = await Gestion.findByPk(id, {
      include: [
        {
          model: UsuarioAgencia,
          as: "usuarioAgencia",
          attributes: ["id"],
          include: [
            {
              model: Usuario,
              as: "usuario",
              attributes: ["id", "nombre"],
            },
            {
              model: Agencia,
              as: "agencia",
              attributes: ["id", "nombre"],
            },
          ],
        },
        {
          model: Dispositivo,
          as: "dispositivo",
          attributes: ["id", "nombre"],
        },
      ],
    });

    if (!gestion) {
      return res.status(404).json({
        message: "Gestión no encontrada",
      });
    }

    return res.json(gestion);
  } catch (error) {
    return res.status(500).json({
      message: "Error al obtener gestión",
      error: error.message,
    });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const gestion = await Gestion.findByPk(id);

    if (!gestion) {
      return res.status(404).json({
        message: "Gestión no encontrada",
      });
    }

    const { accion, otrasCedulas } = req.body;

    let otrasCedulasLimpias = null;

    if (accion === "OTRA_CEDULA" && Array.isArray(otrasCedulas)) {
      otrasCedulasLimpias = otrasCedulas
        .filter( 
          (c) =>
            c &&
            typeof c.cedula === "string" &&
            c.cedula.length === 10 &&
            ["APROBADO", "DENEGADO"].includes(c.solicitud),
        )
        .map((c) => ({
          cedula: c.cedula,
          solicitud: c.solicitud,
        }));
    }

    let regionNormalizada = "SIN_ESPECIFICAR";

    if (req.body.region && req.body.region.trim() !== "") {
      regionNormalizada = req.body.region.trim();
    }

    // Normalizar solicitud
    let solicitudNormalizada = "NINGUNA";

    if (req.body.solicitud && req.body.solicitud.trim() !== "") {
      solicitudNormalizada = req.body.solicitud.trim();
    }

    await gestion.update({
      ...req.body,
      solicitud: solicitudNormalizada,
      region: regionNormalizada,
      otrasCedulas: otrasCedulasLimpias,
    });

    return res.json(gestion);
  } catch (error) {
    return res.status(500).json({
      message: "Error al actualizar gestión",
      error: error.message,
    });
  }
});

module.exports = router;
