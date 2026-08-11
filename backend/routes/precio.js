const express = require("express");
const router = express.Router();
const CostoHistorico = require("../models/CostoHistorico");
const FormaPago = require("../models/FormaPago");
const { Op } = require("sequelize");
const {
  obtenerEtiquetaTipoPrecio,
  seleccionarPrecioCostoHistorico,
} = require("../utils/seleccionarPrecioCostoHistorico");

router.get("/:modeloId/:formaPagoId?", async (req, res) => {
  try {
    const modeloId = parseInt(req.params.modeloId, 10);
    const formaPagoId = parseInt(req.params.formaPagoId, 10);

    if (Number.isNaN(modeloId)) {
      return res.status(400).json({ message: "ID de modelo invalido" });
    }

    const formaPago = Number.isNaN(formaPagoId)
      ? null
      : await FormaPago.findByPk(formaPagoId);

    const { fecha } = req.query;

    const costoHistorico = await CostoHistorico.findOne({
      where: {
        modeloId,
        ...(fecha && {
          fechaCompra: {
            [Op.lte]: fecha,
          },
        }),
      },
      order: [
        ["fechaCompra", "DESC"],
        ["id", "DESC"],
      ],
    });

    if (!costoHistorico) {
      return res.status(404).json({ message: "No se encontro costo historico para este modelo" });
    }

    const { precio, tipoPrecio, tipoPrecioSolicitado } =
      seleccionarPrecioCostoHistorico(costoHistorico, formaPago);

    if (!Number.isFinite(precio) || precio <= 0) {
      return res.status(404).json({
        message: `No existe ${obtenerEtiquetaTipoPrecio(tipoPrecioSolicitado)} para este modelo`,
      });
    }

    res.json({
      modeloId,
      formaPagoId: Number.isNaN(formaPagoId) ? null : formaPagoId,
      tipoPrecio,
      precio,
      costo: Number(costoHistorico.costo),
      costoHistoricoId: costoHistorico.id,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener precio" });
  }
});

module.exports = router;
