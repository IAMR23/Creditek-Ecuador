const Producto = require("../models/Producto");

// Crear producto
exports.crearProducto = async (req, res) => {
  try {
    const { nombre, activo } = req.body;
    const nuevoProducto = await Producto.create({ nombre, activo });
    res.status(201).json(nuevoProducto);
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "Error al crear el producto" });
  }
};

// Listar todos los productos
exports.listarProductos = async (req, res) => {
  try {
    const productos = await Producto.findAll();
    res.json(productos);
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "Error al obtener los productos" });
  }
};

// Obtener producto por ID
exports.obtenerProducto = async (req, res) => {
  try {
    const producto = await Producto.findByPk(req.params.id);
    if (!producto) return res.status(404).json({ mensaje: "Producto no encontrado" });
    res.json(producto);
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "Error al obtener el producto" });
  }
};

// Actualizar producto
exports.actualizarProducto = async (req, res) => {
  try {
    const { nombre, activo } = req.body;
    const productoExistente = await Producto.findByPk(req.params.id);
    if (!productoExistente) return res.status(404).json({ mensaje: "Producto no encontrado" });

    await productoExistente.update({ nombre, activo });
    res.json(productoExistente);
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "Error al actualizar el producto" });
  }
};

// Eliminar producto
exports.eliminarProducto = async (req, res) => {
  try {
    const productoExistente = await Producto.findByPk(req.params.id);
    if (!productoExistente) return res.status(404).json({ mensaje: "Producto no encontrado" });

    await productoExistente.destroy();
    res.json({ mensaje: "Producto eliminado correctamente" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: "Error al eliminar el producto" });
  }
};
