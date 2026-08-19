const path = require("path");
const facturasFisicasService = require("../../services/facturasFisicasService");

const nombreDescargaSeguro = (value) =>
  path.basename(value || "factura").replace(/[\r\n"]/g, "_");

const responderError = (res, error) => {
  const status = error.statusCode || 500;
  return res.status(status).json({
    ok: false,
    duplicado: Boolean(error.duplicado),
    message: error.message || "No se pudo procesar la factura fisica.",
    ...(error.facturaExistente
      ? { facturaExistente: error.facturaExistente }
      : {}),
  });
};

const subirFactura = async (req, res) => {
  try {
    const factura = await facturasFisicasService.crearFactura({
      file: req.file,
      body: req.body,
      usuarioId: req.user.id,
    });
    return res.status(201).json({
      ok: true,
      message: "Factura fisica registrada correctamente.",
      factura,
    });
  } catch (error) {
    return responderError(res, error);
  }
};

const listarFacturas = async (req, res) => {
  try {
    return res.json(await facturasFisicasService.listarFacturas(req.query));
  } catch (error) {
    return responderError(res, error);
  }
};

const obtenerFactura = async (req, res) => {
  try {
    return res.json({
      ok: true,
      factura: await facturasFisicasService.obtenerFactura(req.params.id),
    });
  } catch (error) {
    return responderError(res, error);
  }
};

const actualizarFactura = async (req, res) => {
  try {
    const factura = await facturasFisicasService.actualizarFactura(
      req.params.id,
      req.body,
      req.user.id,
    );
    return res.json({
      ok: true,
      message: "Factura fisica actualizada correctamente.",
      factura,
    });
  } catch (error) {
    return responderError(res, error);
  }
};

const anularFactura = async (req, res) => {
  try {
    const factura = await facturasFisicasService.anularFactura(
      req.params.id,
      req.body,
      req.user.id,
    );
    return res.json({
      ok: true,
      message: "Factura fisica anulada correctamente.",
      factura,
    });
  } catch (error) {
    return responderError(res, error);
  }
};

const verArchivo = async (req, res) => {
  try {
    const archivo = await facturasFisicasService.obtenerArchivoFactura(
      req.params.id,
    );
    res.setHeader("Content-Type", archivo.mimeType);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${nombreDescargaSeguro(archivo.nombreArchivoOriginal)}"`,
    );
    return res.sendFile(archivo.rutaAbsoluta);
  } catch (error) {
    return responderError(res, error);
  }
};

module.exports = {
  actualizarFactura,
  anularFactura,
  listarFacturas,
  obtenerFactura,
  subirFactura,
  verArchivo,
};
