const facturasIaService = require("../../services/facturasIaService");

const responderError = (res, error) =>
  res.status(error.statusCode || 500).json({
    ok: false,
    message: error.message || "No se pudo procesar la factura IA.",
    ...(error.codigo ? { code: error.codigo } : {}),
  });

const cargarJson = async (req, res) => {
  try {
    const resultados = await facturasIaService.cargarArchivoJson({
      file: req.file,
      grupoComparacion: req.body?.grupoComparacion,
      usuarioId: req.user.id,
    });
    return res.status(201).json({
      ok: true,
      message: `${resultados.length} factura(s) IA cargada(s) correctamente.`,
      resultados,
    });
  } catch (error) {
    return responderError(res, error);
  }
};

const listar = async (req, res) => {
  try {
    return res.json(await facturasIaService.listarResultados(req.query));
  } catch (error) {
    return responderError(res, error);
  }
};

const obtener = async (req, res) => {
  try {
    return res.json({
      ok: true,
      resultado: await facturasIaService.obtenerResultado(req.params.id),
    });
  } catch (error) {
    return responderError(res, error);
  }
};

const seleccionar = async (req, res) => {
  try {
    return res.json({
      ok: true,
      message: "Resultado seleccionado como mejor opcion del grupo.",
      resultado: await facturasIaService.seleccionarResultado({
        id: req.params.id,
        usuarioId: req.user.id,
      }),
    });
  } catch (error) {
    return responderError(res, error);
  }
};

const exportarDatos = async (req, res) => {
  try {
    return res.json({
      ok: true,
      resultados: await facturasIaService.listarParaExportar(req.query),
    });
  } catch (error) {
    return responderError(res, error);
  }
};

module.exports = {
  cargarJson,
  exportarDatos,
  listar,
  obtener,
  seleccionar,
};
