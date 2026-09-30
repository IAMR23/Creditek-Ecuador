const {
  asignarUsuarioUphone,
  listarNormalizaciones,
} = require("../../services/uphoneUsuariosNormalizacionService");

const listar = async (_req, res) => {
  try {
    const resultado = await listarNormalizaciones();
    return res.json({ ok: true, ...resultado });
  } catch (error) {
    console.error("Error listando normalizaciones Uphone:", error);
    return res.status(500).json({
      ok: false,
      message: "No se pudo cargar la normalización de usuarios Uphone.",
    });
  }
};

const asignar = async (req, res) => {
  try {
    const resultado = await asignarUsuarioUphone({
      usuarioUphone: req.params.usuarioUphone,
      usuarioId: req.body?.usuarioId,
    });

    return res.json({
      ok: true,
      message: resultado.usuarioRve
        ? `La clave ${resultado.usuarioUphone} fue asignada correctamente.`
        : `La clave ${resultado.usuarioUphone} quedó sin asignar.`,
      normalizacion: resultado,
    });
  } catch (error) {
    const statusCode = Number(error.statusCode) || 500;
    if (statusCode >= 500) {
      console.error("Error asignando usuario Uphone:", error);
    }
    return res.status(statusCode).json({
      ok: false,
      code: error.code || "INTERNAL_ERROR",
      message: error.message || "No se pudo guardar la normalización Uphone.",
    });
  }
};

module.exports = { asignar, listar };
