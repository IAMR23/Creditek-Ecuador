const express = require("express");
const { Op } = require("sequelize");
const router = express.Router();
const CostoHistorico = require("../models/CostoHistorico");
const Modelo = require("../models/Modelo");

const parseDecimalOpcional = (valor, campo, { permitirNegativo = false } = {}) => {
  if (valor === null || valor === undefined || valor === "") {
    return { value: null };
  }

  const normalizado = typeof valor === "string" ? valor.replace(",", ".") : valor;
  const numero = Number(normalizado);

  if (Number.isNaN(numero)) {
    return { error: `${campo} invalido` };
  }

  if (!permitirNegativo && numero < 0) {
    return { error: `${campo} no puede ser negativo` };
  }

  const decimalPart = String(normalizado).split(".")[1];
  if (decimalPart && decimalPart.length > 2) {
    return { error: `${campo} solo puede tener hasta 2 decimales` };
  }

  return { value: Number(numero.toFixed(2)) };
};

const validarCostoHistorico = async (
  { modeloId, costo, fechaCompra, precioCarga, precioContado },
  excludeId = null,
) => {
  if (!modeloId || !costo || !fechaCompra) {
    return { error: "modeloId, costo y fechaCompra son obligatorios" };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaCompra)) {
    return { error: "Formato de fecha invalido (YYYY-MM-DD)" };
  }

  const modeloIdNum = parseInt(modeloId, 10);
  if (Number.isNaN(modeloIdNum)) {
    return { error: "Modelo invalido" };
  }

  const costoNormalizado = typeof costo === "string" ? costo.replace(",", ".") : costo;
  const costoNum = Number(costoNormalizado);

  if (Number.isNaN(costoNum)) {
    return { error: "Costo invalido" };
  }

  if (costoNum <= 0) {
    return { error: "El costo debe ser mayor a 0" };
  }

  const decimalPart = String(costoNormalizado).split(".")[1];
  if (decimalPart && decimalPart.length > 2) {
    return { error: "El costo solo puede tener hasta 2 decimales" };
  }

  const precioCargaParsed = parseDecimalOpcional(precioCarga, "Precio carga");
  if (precioCargaParsed.error) return { error: precioCargaParsed.error };

  const precioContadoParsed = parseDecimalOpcional(precioContado, "Precio contado");
  if (precioContadoParsed.error) return { error: precioContadoParsed.error };

  const modelo = await Modelo.findByPk(modeloIdNum);
  if (!modelo) {
    return { error: "Modelo no existe", status: 404 };
  }

  const whereDuplicado = {
    modeloId: modeloIdNum,
    fechaCompra,
  };

  if (excludeId) {
    whereDuplicado.id = { [Op.ne]: excludeId };
  }

  const existe = await CostoHistorico.findOne({ where: whereDuplicado });
  if (existe) {
    return { error: "Ya existe un costo para este modelo en esa fecha" };
  }

  return {
    data: {
      modeloId: modeloIdNum,
      costo: Number(costoNum.toFixed(2)),
      precioCarga: precioCargaParsed.value,
      precioContado: precioContadoParsed.value,
      margen:
        precioCargaParsed.value !== null
          ? Number((precioCargaParsed.value - costoNum).toFixed(2))
          : null,
      margenPorcentual:
        precioCargaParsed.value && precioCargaParsed.value > 0
          ? Number((((precioCargaParsed.value - costoNum) / precioCargaParsed.value) * 100).toFixed(2))
          : null,
      fechaCompra,
    },
  };
};

router.get("/", async (req, res) => {
  try {
    const costos = await CostoHistorico.findAll({
      include: [{ model: Modelo, as: "modelo" }],
      order: [
        [{ model: Modelo, as: "modelo" }, "nombre", "ASC"],
        ["fechaCompra", "DESC"],
        ["id", "DESC"],
      ],
    });

    res.json(costos);
  } catch (error) {
    res.status(500).json({ message: "Error interno del servidor", error: error.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const costo = await CostoHistorico.findByPk(req.params.id, {
      include: [{ model: Modelo, as: "modelo" }],
    });
    if (!costo) return res.status(404).json({ message: "No encontrado" });
    res.json(costo);
  } catch (error) {
    res.status(500).json({ message: "Error interno del servidor", error: error.message });
  }
});

router.post("/", async (req, res) => {
  try {
    const { nota } = req.body;
    const validacion = await validarCostoHistorico(req.body);

    if (validacion.error) {
      return res.status(validacion.status || 400).json({ message: validacion.error });
    }

    const nuevoCosto = await CostoHistorico.create({
      ...validacion.data,
      nota: nota?.trim() || null,
    });

    return res.status(201).json(nuevoCosto);
  } catch (error) {
    console.error("Error al crear costo:", error);
    return res.status(500).json({
      message: "Error interno del servidor",
      error: error.message,
    });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const costo = await CostoHistorico.findByPk(req.params.id);
    if (!costo) return res.status(404).json({ message: "No encontrado" });

    const { nota } = req.body;
    const validacion = await validarCostoHistorico(req.body, costo.id);

    if (validacion.error) {
      return res.status(validacion.status || 400).json({ message: validacion.error });
    }

    await costo.update({
      ...validacion.data,
      nota: nota?.trim() || null,
    });

    res.json(costo);
  } catch (error) {
    res.status(500).json({ message: "Error interno del servidor", error: error.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const costo = await CostoHistorico.findByPk(req.params.id);
    if (!costo) return res.status(404).json({ message: "No encontrado" });
    await costo.destroy();
    res.json({ message: "Eliminado correctamente" });
  } catch (error) {
    res.status(500).json({ message: "Error interno del servidor", error: error.message });
  }
});

module.exports = router;
