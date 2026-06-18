const express = require("express");
const router = express.Router();

const Modelo = require("../models/Modelo");
const DispositivoMarca = require("../models/DispositivoMarca");
const Marca = require("../models/Marca");
const Dispositivo = require("../models/Dispositivo");

const tieneCampo = (objeto, campo) => Object.prototype.hasOwnProperty.call(objeto, campo);

const leerIdentificadorUph = (body) => {
  if (tieneCampo(body, "identificadorUph")) return body.identificadorUph;
  if (tieneCampo(body, "descripcion")) return body.descripcion;
  return undefined;
};

router.post("/", async (req, res) => {
  try {
    const { nombre, activo, dispositivoMarcaId } = req.body;
    const identificadorUph = leerIdentificadorUph(req.body);

    const existeDM = await DispositivoMarca.findByPk(dispositivoMarcaId);
    if (!existeDM) {
      return res.status(400).json({ message: "dispositivoMarcaId no válido" });
    }

    const nuevo = await Modelo.create({
      nombre,
      identificadorUph,
      activo: activo ?? true,
      dispositivoMarcaId,
    });

    res.status(201).json(nuevo);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al crear el modelo", error });
  }
});

// =========================
// 📌 Obtener todos los modelos
// =========================
router.get("/", async (req, res) => {
  try {
    const modelos = await Modelo.findAll({
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
      order: [["id", "DESC"]],
    });

    res.json(modelos);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener modelos", error });
  }
});



router.get("/activos", async (req, res) => {
  try {
    const modelos = await Modelo.findAll({
      where: {
        activo: true, // ✅ filtro correcto
      },
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
    });

    if (!modelos || modelos.length === 0) {
      return res.status(404).json({ message: "No hay modelos activos" });
    }

    res.json(modelos);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener los modelos", error });
  }
});


// =========================
// 📌 Obtener modelo por ID
// =========================
router.get("/:id", async (req, res) => {
  try {
    const modelo = await Modelo.findByPk(req.params.id, {
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
    });

    if (!modelo) {
      return res.status(404).json({ message: "Modelo no encontrado" });
    }

    res.json(modelo);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener el modelo", error });
  }
});

// =========================
// 📌 Actualizar modelo
// =========================
router.put("/:id", async (req, res) => {
  try {
    const { nombre, activo, dispositivoMarcaId } = req.body;
    const identificadorUph = leerIdentificadorUph(req.body);

    const modelo = await Modelo.findByPk(req.params.id);
    if (!modelo) {
      return res.status(404).json({ message: "Modelo no encontrado" });
    }

    if (dispositivoMarcaId) {
      const existe = await DispositivoMarca.findByPk(dispositivoMarcaId);
      if (!existe) {
        return res.status(400).json({ message: "dispositivoMarcaId no válido" });
      }
    }

    const cambios = {};
    if (tieneCampo(req.body, "nombre")) cambios.nombre = nombre;
    if (tieneCampo(req.body, "activo")) cambios.activo = activo;
    if (tieneCampo(req.body, "dispositivoMarcaId")) {
      cambios.dispositivoMarcaId = dispositivoMarcaId;
    }
    if (
      tieneCampo(req.body, "identificadorUph") ||
      tieneCampo(req.body, "descripcion")
    ) {
      cambios.identificadorUph = identificadorUph;
    }

    await modelo.update(cambios);

    res.json(modelo);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al actualizar el modelo", error });
  }
});


router.delete("/:id", async (req, res) => {
  try {
    const modelo = await Modelo.findByPk(req.params.id);
    if (!modelo) {
      return res.status(404).json({ message: "Modelo no encontrado" });
    }

    await modelo.destroy();

    res.json({ message: "Modelo eliminado correctamente" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al eliminar el modelo", error });
  }
});

module.exports = router;
