const express = require("express");
const router = express.Router();

const GestionComercial = require("../../models/GestionComercial");
const UsuarioAgencia = require("../../models/UsuarioAgencia");
const Dispositivo = require("../../models/Dispositivo");
const Usuario = require("../../models/Usuario");
const Agencia = require("../../models/Agencia");
const { Op } = require("sequelize");

// Crear gestión comercial
router.post("/", async (req, res) => {
  try {
    const {
      usuarioAgenciaId,
      celularGestionado,
      cedulaGestionado,
      dispositivoId,
      solicitud,
      origen,
      observacion,
    } = req.body;

    if (!usuarioAgenciaId) {
      return res.status(400).json({
        message: "usuarioAgenciaId es obligatorio",
      });
    }

    let solicitudNormalizada = "NINGUNA";

    if (solicitud && solicitud.trim() !== "") {
      const valor = solicitud.trim().toUpperCase();

      if (!["NINGUNA", "APROBADO", "DENEGADO"].includes(valor)) {
        return res.status(400).json({
          message: "La solicitud debe ser NINGUNA, APROBADO o DENEGADO",
        });
      }

      solicitudNormalizada = valor;
    }

    const nuevaGestion = await GestionComercial.create({
      usuarioAgenciaId,
      celularGestionado: celularGestionado || null,
      cedulaGestionado: cedulaGestionado || null,
      dispositivoId: dispositivoId || null,
      solicitud: solicitudNormalizada,
      origen: origen || null,
      observacion: observacion || null,
    });

    return res.status(201).json(nuevaGestion);
  } catch (error) {
    console.error("Error al crear gestión comercial:", error);
    return res.status(500).json({
      message: "Error al crear la gestión comercial",
      error: error.message,
    });
  }
});

// Obtener gestiones por vendedor (usuarioAgenciaId)
router.get("/vendedor/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { fechaInicio, fechaFin, solicitud, origen } = req.query;

    const where = {
      usuarioAgenciaId: id,
    };

    if (fechaInicio && fechaFin) {
      const inicio = new Date(`${fechaInicio}T00:00:00-05:00`);
      const fin = new Date(`${fechaFin}T00:00:00-05:00`);
      fin.setDate(fin.getDate() + 1);

      where.createdAt = {
        [Op.gte]: inicio,
        [Op.lt]: fin,
      };
    }

    if (solicitud) {
      where.solicitud = solicitud.trim().toUpperCase();
    }

    if (origen) {
      where.origen = {
        [Op.iLike]: `%${origen.trim()}%`,
      };
    }

    const gestiones = await GestionComercial.findAll({
      where,
      include: [
        {
          model: UsuarioAgencia,
          as: "usuarioAgencia",
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
      order: [["createdAt", "DESC"]],
    });

    return res.json({
      ok: true,
      total: gestiones.length,
      gestiones,
    });
  } catch (error) {
    console.error("Error al obtener gestiones por vendedor:", error);
    return res.status(500).json({
      ok: false,
      message: "Error al obtener gestiones por vendedor",
      error: error.message,
    });
  }
});

// Obtener todas las gestiones con filtros
router.get("/", async (req, res) => {
  try {
    const {
      fechaInicio,
      fechaFin,
      solicitud,
      origen,
      agenciaId,
      usuarioAgenciaId,
    } = req.query;

    const where = {};

    if (fechaInicio && fechaFin) {
      const inicio = new Date(`${fechaInicio}T00:00:00-05:00`);
      const fin = new Date(`${fechaFin}T00:00:00-05:00`);
      fin.setDate(fin.getDate() + 1);

      where.createdAt = {
        [Op.gte]: inicio,
        [Op.lt]: fin,
      };
    }

    if (solicitud) {
      where.solicitud = solicitud.trim().toUpperCase();
    }

    if (origen) {
      where.origen = {
        [Op.iLike]: `%${origen.trim()}%`,
      };
    }

    if (usuarioAgenciaId && usuarioAgenciaId !== "todos") {
      where.usuarioAgenciaId = Number(usuarioAgenciaId);
    }

    const gestiones = await GestionComercial.findAll({
      where,
      include: [
        {
          model: UsuarioAgencia,
          as: "usuarioAgencia",
          attributes: ["id", "agenciaId", "usuarioId"],
          required: !!(agenciaId && agenciaId !== "todas"),
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
              required: !!(agenciaId && agenciaId !== "todas"),
              ...(agenciaId &&
                agenciaId !== "todas" && {
                  where: { id: Number(agenciaId) },
                }),
            },
          ],
        },
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
    console.error("Error al obtener gestiones:", error);
    return res.status(500).json({
      message: "Error al obtener gestiones",
      error: error.message,
    });
  }
});

// Obtener una gestión por ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const gestion = await GestionComercial.findByPk(id, {
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
        message: "Gestión comercial no encontrada",
      });
    }

    return res.json(gestion);
  } catch (error) {
    console.error("Error al obtener gestión:", error);
    return res.status(500).json({
      message: "Error al obtener gestión",
      error: error.message,
    });
  }
});

// Actualizar gestión
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const gestion = await GestionComercial.findByPk(id);

    if (!gestion) {
      return res.status(404).json({
        message: "Gestión comercial no encontrada",
      });
    }

    const {
      usuarioAgenciaId,
      celularGestionado,
      cedulaGestionado,
      dispositivoId,
      solicitud,
      origen,
      observacion,
    } = req.body;

    let solicitudNormalizada = gestion.solicitud;

    if (solicitud !== undefined) {
      if (solicitud && solicitud.trim() !== "") {
        const valor = solicitud.trim().toUpperCase();

        if (!["NINGUNA", "APROBADO", "DENEGADO"].includes(valor)) {
          return res.status(400).json({
            message: "La solicitud debe ser NINGUNA, APROBADO o DENEGADO",
          });
        }

        solicitudNormalizada = valor;
      } else {
        solicitudNormalizada = "NINGUNA";
      }
    }

    await gestion.update({
      usuarioAgenciaId:
        usuarioAgenciaId !== undefined
          ? usuarioAgenciaId
          : gestion.usuarioAgenciaId,
      celularGestionado:
        celularGestionado !== undefined
          ? celularGestionado
          : gestion.celularGestionado,
      cedulaGestionado:
        cedulaGestionado !== undefined
          ? cedulaGestionado
          : gestion.cedulaGestionado,
      dispositivoId:
        dispositivoId !== undefined ? dispositivoId : gestion.dispositivoId,
      solicitud: solicitudNormalizada,
      origen: origen !== undefined ? origen : gestion.origen,
      observacion: observacion !== undefined ? observacion : gestion.observacion,
    });

    return res.json(gestion);
  } catch (error) {
    console.error("Error al actualizar gestión:", error);
    return res.status(500).json({
      message: "Error al actualizar gestión",
      error: error.message,
    });
  }
});

module.exports = router;