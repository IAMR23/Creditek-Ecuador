const express = require("express");
const router = express.Router();
const { sequelize } = require("../../config/db");

const { authenticate } = require("../../middleware/authMiddleware");
const { cerrarCaja } = require("../../controllers/CierreCaja/cierreCaja");
const CierreCaja = require("../../models/CierreCaja/CierreCaja");
const UsuarioAgencia = require("../../models/UsuarioAgencia");
const Usuario = require("../../models/Usuario");
const Agencia = require("../../models/Agencia");
const Denominacion = require("../../models/CierreCaja/Denominacion");
const RetiroCaja = require("../../models/CierreCaja/RetiroCaja");
const MovimientoCaja = require("../../models/CierreCaja/MovimientoCaja");
const { Op } = require("sequelize");

router.post("/cierre-caja", authenticate, cerrarCaja);

router.get("/cierres-caja", async (req, res) => {
  try {
    const { fechaInicio, fechaFin, agenciaId } = req.query;
    console.log(agenciaId)
    const where = {};

    // 🔹 Filtro por fecha
    if (fechaInicio && fechaFin) {
      where.fecha = {
        [Op.between]: [
          new Date(`${fechaInicio}T00:00:00`),
          new Date(`${fechaFin}T23:59:59`),
        ],
      };
    } else if (fechaInicio) {
      where.fecha = { [Op.gte]: new Date(`${fechaInicio}T00:00:00`) };
    } else if (fechaFin) {
      where.fecha = { [Op.lte]: new Date(`${fechaFin}T23:59:59`) };
    }

    const cierres = await CierreCaja.findAll({
      where,
      order: [["createdAt", "DESC"]],
      include: [
        {
          model: UsuarioAgencia,
          as: "usuarioAgencia",
          attributes: ["id"],
          required: !!agenciaId,
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
              ...(agenciaId &&
                agenciaId !== "todas" && {
                  where: { id: agenciaId },
                }),
            },
          ],
        },

        {
          model: Denominacion,
          as: "denominaciones",
          attributes: ["valor", "cantidad"],
        },

        {
          model: RetiroCaja,
          as: "retiros",
          attributes: ["monto", "motivo", "autorizadoPor"],
        },

        {
          model: MovimientoCaja,
          as: "movimientos",
          attributes: [
            "responsable",
            "detalle",
            "entidad",
            "valor",
            "formaPago",
            "recibo",
            "observacion",
          ],
        },
      ],
    });

    res.json(cierres);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Error al obtener cierres de caja",
      error: error.message,
    });
  }
});

module.exports = router;
