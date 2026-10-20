const facturasService = require("../../services/facturasService");

const responderError = (res, error) =>
  res.status(error.statusCode || 500).json({
    ok: false,
    message: error.message || "No se pudieron procesar las facturas.",
    ...(Number.isInteger(error.indice) ? { indice: error.indice } : {}),
    ...(Array.isArray(error.errores) ? { errores: error.errores } : {}),
    ...(Array.isArray(error.duplicados) ? { duplicados: error.duplicados } : {}),
  });

const cargarJson = async (req, res) => {
  try {
    const facturas = await facturasService.cargarJson({
      file: req.file,
    });
    return res.status(201).json({
      ok: true,
      message: `${facturas.length} factura(s) cargada(s) correctamente.`,
      facturas,
    });
  } catch (error) {
    return responderError(res, error);
  }
};

const cargarJsonTexto = async (req, res) => {
  try {
    const facturas = await facturasService.cargarJsonTexto({
      contenido: req.body?.contenido,
    });
    return res.status(201).json({
      ok: true,
      message: `${facturas.length} factura(s) procesada(s) correctamente.`,
      facturas,
    });
  } catch (error) {
    return responderError(res, error);
  }
};

const cargarExcel = async (req, res) => {
  try {
    const facturas = await facturasService.cargarExcel({
      file: req.file,
    });
    return res.status(201).json({
      ok: true,
      message: `${facturas.length} factura(s) cargada(s) desde Excel correctamente.`,
      facturas,
    });
  } catch (error) {
    return responderError(res, error);
  }
};

const cargarFoto = async (req, res) => {
  try {
    const factura = await facturasService.guardarFotoFactura({
      id: req.params.id,
      file: req.file,
    });
    return res.json({
      ok: true,
      message: "Foto procesada y guardada correctamente.",
      factura,
    });
  } catch (error) {
    return responderError(res, error);
  }
};

const listar = async (req, res) => {
  try {
    return res.json(await facturasService.listar(req.query));
  } catch (error) {
    return responderError(res, error);
  }
};

module.exports = { cargarExcel, cargarFoto, cargarJson, cargarJsonTexto, listar };
