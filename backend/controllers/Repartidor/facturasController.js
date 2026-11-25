const facturasService = require("../../services/facturasService");

const cargarFoto = async (req, res) => {
  try {
    const factura = await facturasService.crearFacturaDesdeFoto({
      file: req.file,
      userId: req.user.id,
    });
    return res.status(201).json({
      ok: true,
      message: "Foto de factura cargada correctamente.",
      factura,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false,
      message: error.message || "No se pudo cargar la foto de la factura.",
    });
  }
};

module.exports = { cargarFoto };
