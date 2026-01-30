const express = require("express");
const router = express.Router();
const Entrega = require("../models/Entrega");
const UsuarioAgencia = require("../models/UsuarioAgencia");
const Cliente = require("../models/Cliente");
const Origen = require("../models/Origen");
const DetalleEntrega = require("../models/DetalleEntrega");
const { default: upload } = require("../middleware/multer");
const {
  fotoClienteRespaldo,
  getEntregasPorUsuarioAgencia,
  fotoFechaRespaldo,
  fotoLogisticaRespaldo,
} = require("../controllers/entregaController");
const {
  asignarEntrega,
} = require("../controllers/Logistica/usuarioAgenciaEntregaController");
const UsuarioAgenciaEntrega = require("../models/UsuarioAgenciaEntrega");
const Modelo = require("../models/Modelo");
const DispositivoMarca = require("../models/DispositivoMarca");
const Dispositivo = require("../models/Dispositivo");
const Marca = require("../models/Marca");
const FormaPago = require("../models/FormaPago");
const EntregaObsequio = require("../models/EntregaObsequio");
const Obsequio = require("../models/Obsequio");

router.get("/mis-entregas/:userId", async (req, res) => {
  const { userId } = req.params;

  try {
    const usuario = await UsuarioAgencia.findByPk(userId, {
      include: [
        {
          model: Entrega,
          as: "entregas", 
          include: [
            {
              model: Cliente,
              as: "cliente",
              attributes: [
                "cliente",
                "cedula",
                "telefono",
                "correo",
                "direccion",
              ],
            },
            { model: Origen, as: "origen", attributes: ["id", "nombre"] },
            {
              model: DetalleEntrega,
              as: "detalleEntregas",
              include: [
                { model: Modelo, as: "modelo", attributes: ["nombre"] },
                {
                  model: DispositivoMarca,
                  as: "dispositivoMarca",
                  include: [
                    {
                      model: Dispositivo,
                      as: "dispositivo",
                      attributes: ["nombre"],
                    },
                    { model: Marca, as: "marca", attributes: ["nombre"] },
                  ],
                },
                { model: FormaPago, as: "formaPago", attributes: ["nombre"] },
              ],
            },
            {
              model: EntregaObsequio,
              as: "obsequiosEntrega",
              include: [
                { model: Obsequio, as: "obsequio", attributes: ["nombre"] },
              ],
            },
          ],
        },
      ],
    });
    res.json(usuario.entregas);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error al obtener tus entregas" });
  }
});

router.post("/:entregaId/asignar-repartidor", asignarEntrega);

// --------------------- CONTROLADORES ---------------------
router.put("/entrega/:id/validar", upload.single("foto"), fotoClienteRespaldo);
router.put(
  "/entrega/:id/fechaRespaldo",
  upload.single("foto"),
  fotoFechaRespaldo,
);
router.put(
  "/entrega/:id/fotoLogistica",
  upload.single("foto"),
  fotoLogisticaRespaldo,
);

router.get("/vendedor/:usuarioAgenciaId", getEntregasPorUsuarioAgencia);

/* OBTENER TODAS LAS ENTREGAS */
router.get("/", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 15;
    const offset = (page - 1) * limit;

    const { count, rows } = await Entrega.findAndCountAll({
      limit,
      offset,
      order: [["createdAt", "DESC"]],
      include: [
        { model: UsuarioAgencia, as: "usuarioAgencia" },
        { model: Cliente, as: "cliente" },
        { model: Origen, as: "origen" },
        {
          model: DetalleEntrega,
          as: "detalleEntregas",
          include: ["dispositivoMarca"],
        },
      ],
      distinct: true, // 🔑 MUY IMPORTANTE con includes
    });

    res.json({
      data: rows,
      pagination: {
        total: count,
        page,
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "Error al obtener las entregas." });
  }
});

// Obtener una entrega por ID
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const entrega = await Entrega.findByPk(id, {
      include: [
        { model: UsuarioAgencia, as: "usuarioAgencia" },
        { model: Cliente, as: "cliente" },
        { model: Origen, as: "origen" },
        {
          model: DetalleEntrega,
          as: "detalleEntregas",
          include: ["dispositivoMarca"],
        },
      ],
    });
    if (!entrega)
      return res.status(404).json({ mensaje: "Entrega no encontrada." });
    res.json(entrega);
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "Error al obtener la entrega." });
  }
});

// Crear una nueva entrega
router.post("/", async (req, res) => {
  const data = req.body;
  try {
    const nuevaEntrega = await Entrega.create(data);
    res.status(201).json(nuevaEntrega);
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "Error al crear la entrega." });
  }
});

router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const data = req.body;
  try {
    const entrega = await Entrega.findByPk(id);
    if (!entrega)
      return res.status(404).json({ mensaje: "Entrega no encontrada." });

    await entrega.update(data);
    res.json(entrega);
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "Error al actualizar la entrega." });
  }
});

// Eliminar una entrega
router.delete("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const entrega = await Entrega.findByPk(id);
    if (!entrega)
      return res.status(404).json({ mensaje: "Entrega no encontrada." });

    await entrega.destroy();
    res.json({ mensaje: "Entrega eliminada correctamente." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "Error al eliminar la entrega." });
  }
});

module.exports = router;
