const express = require("express");
const { col, fn, where: sequelizeWhere } = require("sequelize");

const { authenticate, requirePermission } = require("../middleware/authMiddleware");
const Usuario = require("../models/Usuario");
const {
  consultarUsuarioAbsPorCedula,
} = require("../services/absUsuariosService");

const router = express.Router();

router.use(authenticate, requirePermission("Administracion"));

router.get("/por-cedula/:cedula", async (req, res) => {
  const cedula = String(req.params.cedula || "").trim();

  if (!cedula) {
    return res.status(400).json({
      ok: false,
      encontrado: false,
      message: "La cedula es obligatoria.",
    });
  }

  try {
    const usuariosLocales = await Usuario.findAll({
      where: sequelizeWhere(fn("BTRIM", col("cedula")), cedula),
      attributes: ["id", "nombre", "cedula", "email"],
      limit: 2,
      order: [["id", "ASC"]],
    });

    if (usuariosLocales.length > 0) {
      return res.status(409).json({
        ok: false,
        encontrado: false,
        code:
          usuariosLocales.length > 1
            ? "CEDULA_DUPLICADA_RVE"
            : "USUARIO_YA_EXISTE_RVE",
        message:
          usuariosLocales.length > 1
            ? "Existe mas de un usuario RVE con esta cedula."
            : "El usuario ya existe en RVE.",
        usuarioRve:
          usuariosLocales.length === 1 ? usuariosLocales[0] : undefined,
      });
    }

    const resultado = await consultarUsuarioAbsPorCedula(cedula);
    return res.json(resultado);
  } catch (error) {
    const status = Number(error.statusCode) || 502;
    console.error("Error consultando usuario de ABS desde RVE:", error.message);
    return res.status(status).json({
      ok: false,
      encontrado: false,
      message:
        status === 503
          ? "La consulta hacia ABS no esta configurada."
          : error.message || "No se pudo consultar el usuario en ABS.",
    });
  }
});

module.exports = router;
