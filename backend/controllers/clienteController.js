const Cliente = require("../models/Cliente");
const { buscarPersonaPorCedula } = require("../services/personasService");

exports.buscarClientePorCedula = async (req, res) => {
  const cedula = String(req.params.cedula || "").trim();

  if (!/^\d{10}$/.test(cedula)) {
    return res.status(400).json({
      encontrado: false,
      mensaje: "La cedula debe tener exactamente 10 digitos numericos.",
    });
  }

  try {
    const cliente = await buscarPersonaPorCedula(cedula, {
      attributes: [
        "id",
        "cliente",
        "cedula",
        "telefono",
        "correo",
        "direccion",
      ],
    });

    if (!cliente) {
      return res.status(404).json({
        encontrado: false,
        mensaje: "Cliente nuevo, por favor ingrese los datos.",
      });
    }

    return res.json({ encontrado: true, cliente });
  } catch (error) {
    console.error("Error buscando cliente por cedula:", error);
    return res.status(500).json({
      encontrado: false,
      mensaje: "No se pudo buscar el cliente.",
    });
  }
};

// Crear cliente
exports.crearCliente = async (req, res) => {
  try {
    const { cliente, cedula, telefono } = req.body;
    const nuevoCliente = await Cliente.create({ cliente, cedula, telefono });
    res.status(201).json(nuevoCliente);
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "Error al crear el cliente" });
  }
};

// Listar todos los clientes
exports.listarClientes = async (req, res) => {
  try {
    const clientes = await Cliente.findAll();
    res.json(clientes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "Error al obtener los clientes" });
  }
};

// Obtener cliente por ID
exports.obtenerCliente = async (req, res) => {
  try {
    const cliente = await Cliente.findByPk(req.params.id);
    if (!cliente) return res.status(404).json({ mensaje: "Cliente no encontrado" });
    res.json(cliente);
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "Error al obtener el cliente" });
  }
};

// Actualizar cliente
exports.actualizarCliente = async (req, res) => {
  try {
    const { cliente, cedula, telefono } = req.body;
    const clienteExistente = await Cliente.findByPk(req.params.id);
    if (!clienteExistente) return res.status(404).json({ mensaje: "Cliente no encontrado" });

    await clienteExistente.update({ cliente, cedula, telefono });
    res.json(clienteExistente);
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "Error al actualizar el cliente" });
  }
};

// Eliminar cliente
exports.eliminarCliente = async (req, res) => {
  try {
    const clienteExistente = await Cliente.findByPk(req.params.id);
    if (!clienteExistente) return res.status(404).json({ mensaje: "Cliente no encontrado" });

    await clienteExistente.destroy();
    res.json({ mensaje: "Cliente eliminado correctamente" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "Error al eliminar el cliente" });
  }
};
