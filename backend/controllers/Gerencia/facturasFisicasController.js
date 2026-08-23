const path = require("path");
const facturasFisicasService = require("../../services/facturasFisicasService");
const facturasFisicasOcrService = require("../../services/facturasFisicasOcrService");
const facturasFisicasProductosOcrService = require("../../services/facturasFisicasProductosOcrService");

const nombreDescargaSeguro = (value) =>
  path.basename(value || "factura").replace(/[\r\n"]/g, "_");

const responderError = (res, error) => {
  const status = error.statusCode || 500;
  return res.status(status).json({
    ok: false,
    duplicado: Boolean(error.duplicado),
    message: error.message || "No se pudo procesar la factura fisica.",
    ...(error.codigo ? { code: error.codigo } : {}),
    ...(Array.isArray(error.conflictos) ? { conflictos: error.conflictos } : {}),
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

const procesarOcr = async (req, res) => {
  try {
    const factura = await facturasFisicasOcrService.procesarOcrFactura({
      id: req.params.id,
      usuarioId: req.user.id,
    });
    const productosOcr =
      await facturasFisicasProductosOcrService.listarProductos(req.params.id);
    return res.json({
      ok: true,
      message: "OCR procesado correctamente.",
      factura,
      ...productosOcr,
    });
  } catch (error) {
    return responderError(res, error);
  }
};

const aplicarOcr = async (req, res) => {
  try {
    const resultado = await facturasFisicasOcrService.aplicarSugerenciasOcr({
      id: req.params.id,
      usuarioId: req.user.id,
      campos: req.body?.campos,
      sobrescribirDatosAdicionales:
        req.body?.sobrescribirDatosAdicionales === true,
    });
    return res.json({
      ok: true,
      message: "Sugerencias OCR aplicadas correctamente.",
      ...resultado,
    });
  } catch (error) {
    return responderError(res, error);
  }
};

const listarProductosOcr = async (req, res) => {
  try {
    return res.json({
      ok: true,
      ...(await facturasFisicasProductosOcrService.listarProductos(req.params.id)),
    });
  } catch (error) {
    return responderError(res, error);
  }
};

const editarProductoOcr = async (req, res) => {
  try {
    const producto = await facturasFisicasProductosOcrService.editarProducto({
      facturaId: req.params.id,
      productoId: req.params.productoId,
      payload: req.body,
      usuarioId: req.user.id,
    });
    return res.json({
      ok: true,
      message: "Producto OCR actualizado correctamente.",
      producto,
    });
  } catch (error) {
    return responderError(res, error);
  }
};

const confirmarProductoOcr = async (req, res) => {
  try {
    const producto =
      await facturasFisicasProductosOcrService.cambiarEstadoProducto({
        facturaId: req.params.id,
        productoId: req.params.productoId,
        usuarioId: req.user.id,
        estado: "CONFIRMADO",
      });
    return res.json({
      ok: true,
      message: "Producto OCR confirmado correctamente.",
      producto,
    });
  } catch (error) {
    return responderError(res, error);
  }
};

const descartarProductoOcr = async (req, res) => {
  try {
    const producto =
      await facturasFisicasProductosOcrService.cambiarEstadoProducto({
        facturaId: req.params.id,
        productoId: req.params.productoId,
        usuarioId: req.user.id,
        estado: "DESCARTADO",
      });
    return res.json({
      ok: true,
      message: "Producto OCR descartado sin eliminar su trazabilidad.",
      producto,
    });
  } catch (error) {
    return responderError(res, error);
  }
};

module.exports = {
  aplicarOcr,
  actualizarFactura,
  anularFactura,
  confirmarProductoOcr,
  descartarProductoOcr,
  editarProductoOcr,
  listarFacturas,
  listarProductosOcr,
  obtenerFactura,
  procesarOcr,
  subirFactura,
  verArchivo,
};
