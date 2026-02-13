const express = require("express");
const router = express.Router();

const Gestion = require("../../models/Gestion");
const UsuarioAgencia = require("../../models/UsuarioAgencia");
const Dispositivo = require("../../models/Dispositivo");
const { Op } = require("sequelize");
const Usuario = require("../../models/Usuario");
const Agencia = require("../../models/Agencia");


// 🔹 CREAR GESTION
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
      otrasCedulas,
    } = req.body;

    // 🔎 Validaciones básicas
    if (!usuarioAgenciaId || !celularGestionado || !cedulaGestionado) {
      return res.status(400).json({
        message: "Campos obligatorios faltantes",
      });
    }

    // 🔥 Validación especial
    if (accion === "OTRA_CEDULA") {
      if (!otrasCedulas || !Array.isArray(otrasCedulas) || otrasCedulas.length === 0) {
        return res.status(400).json({
          message: "Debe ingresar al menos una cédula adicional",
        });
      }
    }

    // Crear registro
    const nuevaGestion = await Gestion.create({
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
      otrasCedulas: accion === "OTRA_CEDULA" ? otrasCedulas : null,
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

// 🔹 LISTAR TODAS LAS GESTIONES

router.get("/", async (req, res) => {
  try {
    const gestiones = await Gestion.findAll({
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



// 🔹 ACTUALIZAR GESTION
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const gestion = await Gestion.findByPk(id);

    if (!gestion) {
      return res.status(404).json({
        message: "Gestión no encontrada",
      });
    }

    const {
      accion,
      otrasCedulas,
    } = req.body;

    // Validación para OTRA_CEDULA
    if (accion === "OTRA_CEDULA") {
      if (!otrasCedulas || !Array.isArray(otrasCedulas) || otrasCedulas.length === 0) {
        return res.status(400).json({
          message: "Debe ingresar al menos una cédula adicional",
        });
      }
    }

    await gestion.update({
      ...req.body,
      otrasCedulas: accion === "OTRA_CEDULA" ? otrasCedulas : null,
    });

    return res.json(gestion);

  } catch (error) {
    return res.status(500).json({
      message: "Error al actualizar gestión",
      error: error.message,
    });
  }
});


// 🔹 ELIMINAR GESTION
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const gestion = await Gestion.findByPk(id);

    if (!gestion) {
      return res.status(404).json({
        message: "Gestión no encontrada",
      });
    }

    await gestion.destroy();

    return res.json({
      message: "Gestión eliminada correctamente",
    });

  } catch (error) {
    return res.status(500).json({
      message: "Error al eliminar gestión",
      error: error.message,
    });
  }
});


module.exports = router;
