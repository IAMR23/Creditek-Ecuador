const servicio = require("../../services/logisticaCombustibleService");

const manejar =
  (operacion, status = 200) =>
  async (req, res) => {
    try {
      const resultado = await operacion({
        user: req.user,
        query: req.query,
        id: req.params.id,
        data: req.body,
      });
      return res.status(status).json({ ok: true, ...resultado });
    } catch (error) {
      const statusError =
        error.status || (error.name === "SequelizeValidationError" ? 400 : 500);
      if (statusError >= 500)
        console.error("Error en registros de combustible", {
          code:
            error.original?.code || error.code || "COMBUSTIBLE_INTERNAL_ERROR",
        });
      return res.status(statusError).json({
        ok: false,
        code:
          statusError >= 500
            ? "COMBUSTIBLE_INTERNAL_ERROR"
            : error.code || "COMBUSTIBLE_VALIDACION",
        message:
          statusError >= 500
            ? "No se pudo completar la operación de combustible."
            : error.message,
      });
    }
  };

exports.listar = manejar(servicio.listar);
exports.obtener = manejar(async (args) => ({
  registro: await servicio.obtener(args),
}));
exports.crear = manejar(
  async (args) => ({ registro: await servicio.crear(args) }),
  201,
);
exports.actualizar = manejar(async (args) => ({
  registro: await servicio.actualizar(args),
}));
exports.eliminar = manejar(async (args) => {
  await servicio.eliminar(args);
  return { message: "Registro eliminado." };
});
exports.repartidores = manejar(async (args) => ({
  repartidores: await servicio.repartidores(args),
}));
