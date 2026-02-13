const express = require("express");
const router = express.Router();
const { sequelize } = require("../config/db");

const Traslado = require("../models/Traslado");
const DetalleTraslado = require("../models/DetalleTraslado");
const Agencia = require("../models/Agencia");
const DispositivoMarca = require("../models/DispositivoMarca");
const Dispositivo = require("../models/Dispositivo");
const Marca = require("../models/Marca");
const Modelo = require("../models/Modelo");
const { Op } = require("sequelize");


router.post("/", async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const {
      estado,
      usuario_agencia_id,
      agencia_destino_id,
      agencia_origen_id,
      detalles,
      obsequios, // 👈 nuevo
    } = req.body;

    // Validación básica
    if (!detalles || !Array.isArray(detalles) || detalles.length === 0) {
      return res.status(400).json({
        message: "Debe enviar al menos un detalle de traslado",
      });
    }

    // 1️⃣ Crear traslado
    const traslado = await Traslado.create(
      {
        estado,
        usuario_agencia_id,
        agencia_destino_id,
        agencia_origen_id,
      },
      { transaction: t }
    );

    // 2️⃣ Crear detalles
    const detallesConTrasladoId = detalles.map((item) => ({
      ...item,
      trasladoId: traslado.id,
    }));

    await DetalleTraslado.bulkCreate(detallesConTrasladoId, {
      transaction: t,
    });

    // 3️⃣ Crear obsequios (si existen)
    if (obsequios && Array.isArray(obsequios) && obsequios.length > 0) {
      const obsequiosConTrasladoId = obsequios.map((item) => ({
        obsequioId: item.obsequioId,
        cantidad: item.cantidad || 1,
        trasladoId: traslado.id,
      }));

      await TrasladoObsequio.bulkCreate(obsequiosConTrasladoId, {
        transaction: t,
      });
    }

    // 4️⃣ Confirmar transacción
    await t.commit();

    return res.status(201).json({
      message: "Traslado creado correctamente",
      trasladoId: traslado.id,
    });
  } catch (error) {
    await t.rollback();

    console.error(error);
    return res.status(500).json({
      message: "Error al crear traslado",
      error: error.message,
    });
  }
});


router.get("/", async (req, res) => {
  try {
    const { fecha } = req.query;

    let whereCondition = {};

    // 📌 Si viene fecha → filtrar por día completo
    if (fecha) {
      const inicio = new Date(fecha);
      inicio.setHours(0, 0, 0, 0);

      const fin = new Date(fecha);
      fin.setHours(23, 59, 59, 999);

      whereCondition.createdAt = {
        [Op.between]: [inicio, fin],
      };
    }

    const traslados = await Traslado.findAll({
      attributes: ["id", "estado", "createdAt"],
      where: whereCondition,
      order: [["createdAt", "DESC"]],
      include: [
        {
          model: Agencia,
          as: "agenciaOrigen",
          attributes: ["id", "nombre"],
        },
        {
          model: Agencia,
          as: "agenciaDestino",
          attributes: ["id", "nombre"],
        },
        {
          model: DetalleTraslado,
          as: "detalles",
          attributes: ["id", "cantidad"],
          include: [
            {
              model: DispositivoMarca,
              as: "dispositivoMarca",
              attributes: ["id"],
              include: [
                {
                  model: Dispositivo,
                  as: "dispositivo",
                  attributes: ["id", "nombre"],
                },
                {
                  model: Marca,
                  as: "marca",
                  attributes: ["id", "nombre"],
                },
              ],
            },
            {
              model: Modelo,
              as: "modelo",
              attributes: ["id", "nombre"],
            },
          ],
        },
      ],
      distinct: true,
    });

    return res.status(200).json(traslados);
  } catch (error) {
    console.error("Error en GET traslados:", error);
    return res.status(500).json({
      message: "Error al obtener traslados",
      error: error.message,
    });
  }
});


module.exports = router;
