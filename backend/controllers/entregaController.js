const Entrega = require("../models/Entrega");
const Cliente = require("../models/Cliente");
const Producto = require("../models/Producto");
const UsuarioAgencia = require("../models/UsuarioAgencia");
const { Op } = require("sequelize");
const Usuario = require("../models/Usuario");
const Agencia = require("../models/Agencia");

// Crear entrega
exports.crearEntrega = async (req, res) => {
  try {
    const {
      contrato,
      origen,
      valor_entrada,
      valor_alcance,
      ubicacion,
      ubicacion_dispositivo,
      obsequios,
      observacion,
      estado,
      clienteId,
      productoId,
      usuarioAgenciaId,
    } = req.body;

    const nuevaEntrega = await Entrega.create({
      contrato,
      origen,
      valor_entrada,
      valor_alcance,
      ubicacion,
      ubicacion_dispositivo,
      obsequios,
      observacion,
      estado,
      clienteId,
      productoId,
      usuarioAgenciaId,
    });

    const entregaConRelaciones = await Entrega.findByPk(nuevaEntrega.id, {
      include: [
        { model: Cliente, as: "cliente" },
        { model: Producto, as: "producto" },
        { model: UsuarioAgencia, as: "usuario_agencia" },
      ],
    });

    res.status(201).json(entregaConRelaciones);
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "Error al crear la entrega" });
  }
};

// Listar todas las entregas
exports.listarEntregas = async (req, res) => {
  try {
    const entregas = await Entrega.findAll({
      include: [
        { model: Cliente, as: "cliente" },
        { model: Producto, as: "producto" },
        { model: UsuarioAgencia, as: "usuario_agencia" },
      ],
    });
    res.json(entregas);
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "Error al obtener las entregas" });
  }
};

// Obtener entrega por ID
exports.obtenerEntrega = async (req, res) => {
  try {
    const entrega = await Entrega.findByPk(req.params.id, {
      include: [
        { model: Cliente, as: "cliente" },
        { model: Producto, as: "producto" },
        { 
          model: UsuarioAgencia, 
          as: "usuario_agencia",
          include: [
            { model: Usuario, as: "usuario" },   // vendedor
            { model: Agencia, as: "agencia" }    // agencia
          ]
        },
      ],
    });

    if (!entrega) {
      return res.status(404).json({ mensaje: "Entrega no encontrada" });
    }

    res.json(entrega);
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "Error al obtener la entrega" });
  }
};


exports.cambiarEstadoEntrega = async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body;

  if (!["aprobado", "rechazado", "pendiente"].includes(estado)) {
    return res.status(400).json({ message: "Estado inválido" });
  }

  const entrega = await Entrega.update(
    { estado },
    { where: { id } }
  );

  res.json({ message: "Estado actualizado", entrega });
};


// Actualizar entrega
exports.actualizarEntrega = async (req, res) => {
  try {
    const entregaExistente = await Entrega.findByPk(req.params.id);
    if (!entregaExistente) return res.status(404).json({ mensaje: "Entrega no encontrada" });

    const {
      contrato,
      origen,
      valor_entrada,
      valor_alcance,
      ubicacion,
      ubicacion_dispositivo,
      obsequios,
      observacion,
      estado,
      clienteId,
      productoId,
      usuarioAgenciaId,
    } = req.body;

    await entregaExistente.update({
      contrato,
      origen,
      valor_entrada,
      valor_alcance,
      ubicacion,
      ubicacion_dispositivo,
      obsequios,
      observacion,
      estado,
      clienteId,
      productoId,
      usuarioAgenciaId,
    });

    const entregaActualizada = await Entrega.findByPk(entregaExistente.id, {
      include: [
        { model: Cliente, as: "cliente" },
        { model: Producto, as: "producto" },
        { model: UsuarioAgencia, as: "usuario_agencia" },
      ],
    });

    res.json(entregaActualizada);
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "Error al actualizar la entrega" });
  }
};

// Eliminar entrega
exports.eliminarEntrega = async (req, res) => {
  try {
    const entregaExistente = await Entrega.findByPk(req.params.id);
    if (!entregaExistente) return res.status(404).json({ mensaje: "Entrega no encontrada" });

    await entregaExistente.destroy();
    res.json({ mensaje: "Entrega eliminada correctamente" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "Error al eliminar la entrega" });
  }
};


exports.filtrarEntregas = async (req, res) => {
  try {
    const {
      fechaInicio,
      fechaFin,
      clienteId,
      usuarioAgenciaId,
      estado,
    } = req.query;

    let where = {};

    // 📌 FILTRO POR FECHAS
    if (fechaInicio || fechaFin) {
      where.createdAt = {
        ...(fechaInicio && { [Op.gte]: new Date(fechaInicio + " 00:00:00") }),
        ...(fechaFin && { [Op.lte]: new Date(fechaFin + " 23:59:59") }),
      };
    } else {
      // 📌 SI NO ENVÍAN FECHAS → FECHA DE HOY
      const hoy = new Date().toISOString().slice(0, 10);
      where.createdAt = {
        [Op.gte]: new Date(hoy + " 00:00:00"),
        [Op.lte]: new Date(hoy + " 23:59:59"),
      };
    }

    // 📌 OPCIONALES
    if (clienteId) where.clienteId = clienteId;
    if (usuarioAgenciaId) where.usuarioAgenciaId = usuarioAgenciaId;
    if (estado) where.estado = estado;

    const entregas = await Entrega.findAll({
      where,
      include: [
        { model: Cliente ,   as: "cliente"},
        { model: Producto  , as: "producto"},
        { model: UsuarioAgencia , as : "usuario_agencia"},
      ],
      order: [["createdAt", "DESC"]],
    });

    res.json(entregas);
  } catch (error) {
    console.error("Error en filtro:", error);
    res.status(500).json({ error: "Error al filtrar entregas" });
  }
};

