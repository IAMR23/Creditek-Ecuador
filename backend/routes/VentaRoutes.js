const express = require("express");
const router = express.Router();

const Venta = require("../models/Venta");
const UsuarioAgencia = require("../models/UsuarioAgencia");
const Producto = require("../models/Producto");
const { Op  , Sequelize} = require("sequelize");
const Agencia = require("../models/Agencia");
const Usuario = require("../models/Usuario");


router.get("/por-dia", async (req, res) => {
  const data = await Venta.findAll({
    attributes: [
      [Sequelize.fn("DATE", Sequelize.col("createdAt")), "fecha"],
      [Sequelize.fn("COUNT", "*"), "total"]
    ],
    group: ["fecha"],
    order: [["fecha", "ASC"]]
  });
  res.json(data);
}); 


router.get("/filter", async (req, res) => {
  try {
    const {
      fechaInicio,
      fechaFin,
      agenciaId,
      usuarioAgenciaId,
      productoId,
      activo,
    } = req.query;

    const where = {};
    const include = [
      {
        model: UsuarioAgencia,
        as: "usuarioAgencia",
        include: [
          { model: Agencia, as: "agencia" },
          { model: Usuario, as: "usuario" } // ← Añadido
        ]
      },
      { model: Producto, as: "producto" },
    ];

    // ------ FILTROS DIRECTOS DE LA TABLA ------
    if (fechaInicio && fechaFin) {
      where.createdAt = {
        [Op.between]: [
          new Date(fechaInicio + " 00:00:00"),
          new Date(fechaFin + " 23:59:59"),
        ],
      };
    }

    if (usuarioAgenciaId) where.usuarioAgenciaId = usuarioAgenciaId;
    if (productoId) where.productoId = productoId;

    if (activo !== undefined) {
      where.activo = activo === "true";
    }

    // ------ FILTRO POR AGENCIA ------
    if (agenciaId) {
      include[0].where = { agenciaId };
      include[0].required = true; // INNER JOIN
    }

    const ventas = await Venta.findAll({
      where,
      include,
      order: [["createdAt", "DESC"]],
    });

    res.json(ventas);

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error al filtrar ventas",
      error: error.message,
    });
  }
});

router.post("/", async (req, res) => {
  try {
    const { 
      usuarioAgenciaId,
      productoId,
      entrada,
      alcance,
      origen,
      obsequios,
      activo
    } = req.body;

    // Validar relaciones
    const ua = await UsuarioAgencia.findByPk(usuarioAgenciaId);
    if (!ua) return res.status(400).json({ message: "Usuario-Agencia no encontrado" });

    const producto = await Producto.findByPk(productoId);
    if (!producto) return res.status(400).json({ message: "Producto no encontrado" });

    const venta = await Venta.create({
      usuarioAgenciaId,
      productoId,
      entrada,
      alcance,
      origen,
      obsequios,
      activo: activo ?? true,
    });

    res.status(201).json(venta);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al crear venta", error });
  }
});

router.get("/", async (req, res) => {
  try {
    const ventas = await Venta.findAll({
   include: [
  { model: UsuarioAgencia, as: "usuarioAgencia" },
  { model: Producto, as: "producto" },
]

    });
    res.json(ventas);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener ventas", error });
  }  
});

router.get("/:id", async (req, res) => {
  try {
    const venta = await Venta.findByPk(req.params.id, {
      include: [
        { model: UsuarioAgencia , as: "usuarioAgencia" },
        { model: Producto ,  as: "producto"},
      ],
    });

    if (!venta) return res.status(404).json({ message: "Venta no encontrada" });

    res.json(venta);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener venta", error });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const { 
      usuarioAgenciaId,
      productoId,
      entrada,
      alcance,
      origen,
      obsequios,
      activo
    } = req.body;

    const venta = await Venta.findByPk(req.params.id);
    if (!venta) return res.status(404).json({ message: "Venta no encontrada" });

    // Validar usuario-agencia
    if (usuarioAgenciaId) {
      const ua = await UsuarioAgencia.findByPk(usuarioAgenciaId);
      if (!ua) return res.status(400).json({ message: "Usuario-Agencia no encontrado" });
      venta.usuarioAgenciaId = usuarioAgenciaId;
    }

    // Validar producto
    if (productoId) {
      const producto = await Producto.findByPk(productoId);
      if (!producto) return res.status(400).json({ message: "Producto no encontrado" });
      venta.productoId = productoId;
    }

    venta.entrada = entrada ?? venta.entrada;
    venta.alcance = alcance ?? venta.alcance;
    venta.origen = origen ?? venta.origen;
    venta.obsequios = obsequios ?? venta.obsequios;
    venta.activo = activo ?? venta.activo;

    await venta.save();

    res.json(venta);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al actualizar venta", error });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const venta = await Venta.findByPk(req.params.id);

    if (!venta) return res.status(404).json({ message: "Venta no encontrada" });

    await venta.destroy();

    res.json({ message: "Venta eliminada correctamente" });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al eliminar venta", error });
  }
});



module.exports = router;
 