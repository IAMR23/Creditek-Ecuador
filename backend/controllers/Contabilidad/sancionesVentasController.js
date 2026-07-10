const { obtenerReporteSancionesVentas } = require("../../services/sancionesVentasService");
exports.obtenerReporte = async (req, res) => {
  try {
    const data = await obtenerReporteSancionesVentas(req.query);
    res.json({ ok: true, data, resumen: {
      totalVendedores: data.length,
      totalSancionados: data.filter((row) => row.aplicaSancion).length,
      totalMulta: Number(data.reduce((sum, row) => sum + row.multaTotal, 0).toFixed(2)),
      totalUnidadesFaltantes: data.reduce((sum, row) => sum + row.unidadesFaltantes, 0),
    } });
  } catch (error) {
    res.status(error.statusCode || 500).json({ ok: false, message: error.message || "No se pudo generar el reporte de sanciones" });
  }
};
