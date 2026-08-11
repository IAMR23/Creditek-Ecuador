const {
  guardarListaPrecios,
  obtenerListaPrecios,
} = require("../services/listaPreciosService");

exports.obtener = async (req, res) => {
  try {
    const resultado = await obtenerListaPrecios({
      fechaVigencia: req.query.fecha,
    });
    return res.json({ ok: true, ...resultado });
  } catch (error) {
    console.error("Error obteniendo lista de precios:", error);
    return res.status(error.statusCode || 500).json({
      ok: false,
      message: error.message || "No se pudo obtener la lista de precios",
    });
  }
};

exports.guardar = async (req, res) => {
  try {
    const resultado = await guardarListaPrecios(req.body || {});
    const io = req.app.get("io");
    io?.emit("listaPrecios:updated", {
      fechaVigencia: resultado.fechaVigencia,
    });

    return res.json({
      ok: true,
      message: "Lista de precios actualizada",
      ...resultado,
    });
  } catch (error) {
    console.error("Error guardando lista de precios:", error);
    return res.status(error.statusCode || 500).json({
      ok: false,
      message: error.message || "No se pudo guardar la lista de precios",
    });
  }
};
