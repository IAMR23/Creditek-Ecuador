const express = require("express");
const router = express.Router();
const PrecioVenta = require("../models/PrecioVenta");
const Modelo = require("../models/Modelo");
const DispositivoMarca = require("../models/DispositivoMarca");
const Marca = require("../models/Marca");
const Dispositivo = require("../models/Dispositivo");

const order = [
  ["marca", "ASC"],
  ["nombre", "ASC"],
];

const modeloInclude = [
  {
    model: Modelo,
    as: "modelo",
    include: [
      {
        model: DispositivoMarca,
        as: "dispositivoMarca",
        include: [
          { model: Marca, as: "marca", attributes: ["id", "nombre"] },
          { model: Dispositivo, as: "dispositivo", attributes: ["id", "nombre"] },
        ],
      },
    ],
  },
];

const listPrecios = () =>
  PrecioVenta.findAll({
    where: { activo: true },
    include: modeloInclude,
    order,
  });

const emitPrecios = async (req) => {
  const io = req.app.get("io");
  if (!io) return;

  const precios = await listPrecios();
  io.emit("preciosVenta:updated", precios);
};

const cleanText = (value) => String(value || "").trim();

const getModeloInfo = async (modeloId) => {
  const id = Number(modeloId);
  if (!id) return null;

  return Modelo.findByPk(id, {
    include: [
      {
        model: DispositivoMarca,
        as: "dispositivoMarca",
        include: [{ model: Marca, as: "marca", attributes: ["id", "nombre"] }],
      },
    ],
  });
};

const buildPayload = async (body) => {
  const modelo = await getModeloInfo(body.modeloId);
  if (!modelo) return null;

  return {
    modeloId: modelo.id,
    marca: cleanText(modelo.dispositivoMarca?.marca?.nombre).toUpperCase(),
    nombre: cleanText(modelo.nombre),
    pvpCredito: cleanText(body.pvpCredito),
    pvpContado: cleanText(body.pvpContado),
    pvpTarjetaCredito: cleanText(body.pvpTarjetaCredito),
    activo: body.activo ?? true,
  };
};

router.get("/", async (req, res) => {
  try {
    const precios = await listPrecios();
    res.json(precios);
  } catch (error) {
    console.error("Error listando precios de venta:", error);
    res.status(500).json({ message: "Error listando precios de venta" });
  }
});

router.get("/modelo/:modeloId", async (req, res) => {
  try {
    const modeloId = Number(req.params.modeloId);
    if (!modeloId) {
      return res.status(400).json({ message: "modeloId invalido" });
    }

    const precio = await PrecioVenta.findOne({
      where: { modeloId, activo: true },
      include: modeloInclude,
      order: [["updatedAt", "DESC"]],
    });

    if (!precio) {
      return res.status(404).json({ message: "No hay precio de venta para este modelo" });
    }

    res.json(precio);
  } catch (error) {
    console.error("Error obteniendo precio de venta por modelo:", error);
    res.status(500).json({ message: "Error obteniendo precio de venta" });
  }
});

router.post("/", async (req, res) => {
  try {
    const payload = await buildPayload(req.body);

    if (!payload) {
      return res.status(400).json({ message: "Debe seleccionar un modelo valido" });
    }

    const precioExistente = await PrecioVenta.findOne({
      where: { modeloId: payload.modeloId, activo: true },
    });

    const precio = precioExistente
      ? await precioExistente.update(payload)
      : await PrecioVenta.create(payload);
    await emitPrecios(req);

    res.status(precioExistente ? 200 : 201).json(precio);
  } catch (error) {
    console.error("Error creando precio de venta:", error);
    res.status(500).json({ message: "Error creando precio de venta" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const precio = await PrecioVenta.findByPk(req.params.id);
    if (!precio) {
      return res.status(404).json({ message: "Precio de venta no encontrado" });
    }

    const payload = await buildPayload(req.body);
    if (!payload) {
      return res.status(400).json({ message: "Debe seleccionar un modelo valido" });
    }

    await precio.update(payload);
    await emitPrecios(req);

    res.json(precio);
  } catch (error) {
    console.error("Error actualizando precio de venta:", error);
    res.status(500).json({ message: "Error actualizando precio de venta" });
  }
});

router.post("/bulk", async (req, res) => {
  try {
    const precios = Array.isArray(req.body?.precios) ? req.body.precios : [];
    const payload = (await Promise.all(precios.map(buildPayload))).filter(Boolean);

    if (payload.length === 0) {
      return res.status(400).json({ message: "Debe enviar al menos un precio con modelo valido" });
    }

    for (const precio of payload) {
      const precioExistente = await PrecioVenta.findOne({
        where: { modeloId: precio.modeloId, activo: true },
      });

      if (precioExistente) {
        await precioExistente.update(precio);
      } else {
        await PrecioVenta.create(precio);
      }
    }

    await emitPrecios(req);

    res.status(201).json({ message: "Precios cargados correctamente", total: payload.length });
  } catch (error) {
    console.error("Error cargando precios de venta:", error);
    res.status(500).json({ message: "Error cargando precios de venta" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const precio = await PrecioVenta.findByPk(req.params.id);
    if (!precio) {
      return res.status(404).json({ message: "Precio de venta no encontrado" });
    }

    await precio.update({ activo: false });
    await emitPrecios(req);

    res.json({ message: "Precio de venta eliminado correctamente" });
  } catch (error) {
    console.error("Error eliminando precio de venta:", error);
    res.status(500).json({ message: "Error eliminando precio de venta" });
  }
});

module.exports = router;
