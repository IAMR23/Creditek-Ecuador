const Cliente = require("../models/Cliente");

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
