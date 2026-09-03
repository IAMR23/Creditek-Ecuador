const egresosCreditekService = require("../../services/egresosCreditekService");

const responderError = (res, error) =>
  res.status(error.statusCode || 500).json({
    message: error.message || "No se pudo procesar Egresos Creditek",
  });

const obtenerEntradas = async (_req, res) => {
  try {
    res.json(await egresosCreditekService.obtenerEntradas());
  } catch (error) {
    responderError(res, error);
  }
};

const crearEntrada = async (req, res) => {
  try {
    const entrada = await egresosCreditekService.crearEntrada(
      req.body,
      req.user.id,
    );
    res.status(201).json({
      message: "Entrada registrada correctamente",
      entrada,
    });
  } catch (error) {
    responderError(res, error);
  }
};

const obtenerSeccion = async (req, res) => {
  try {
    res.json(await egresosCreditekService.obtenerRegistros(req.params.seccion));
  } catch (error) {
    responderError(res, error);
  }
};

const crearRegistro = async (req, res) => {
  try {
    const registro = await egresosCreditekService.crearRegistro(
      req.params.seccion,
      req.body,
      req.user.id,
    );
    res.status(201).json({
      message: "Registro guardado correctamente",
      registro,
    });
  } catch (error) {
    responderError(res, error);
  }
};

const actualizarRegistro = async (req, res) => {
  try {
    const registro = await egresosCreditekService.actualizarRegistro(
      req.params.seccion,
      req.params.id,
      req.body,
      req.user.id,
    );
    res.json({ message: "Registro actualizado correctamente", registro });
  } catch (error) {
    responderError(res, error);
  }
};

const cambiarEstadoRegistro = async (req, res) => {
  try {
    const registro = await egresosCreditekService.cambiarEstadoRegistro(
      req.params.seccion,
      req.params.id,
      req.body.activo,
      req.user.id,
    );
    res.json({ message: "Estado actualizado correctamente", registro });
  } catch (error) {
    responderError(res, error);
  }
};

const eliminarRegistro = async (req, res) => {
  try {
    const registro = await egresosCreditekService.eliminarRegistro(
      req.params.seccion,
      req.params.id,
    );
    res.json({ message: "Registro eliminado definitivamente", registro });
  } catch (error) {
    responderError(res, error);
  }
};

module.exports = {
  actualizarRegistro,
  cambiarEstadoRegistro,
  crearEntrada,
  crearRegistro,
  eliminarRegistro,
  obtenerEntradas,
  obtenerSeccion,
};
