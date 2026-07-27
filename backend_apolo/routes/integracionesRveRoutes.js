const crypto = require("crypto");
const express = require("express");
const { col, fn, where: sequelizeWhere } = require("sequelize");

const Usuario = require("../models/Usuario");

const router = express.Router();

const tokensCoinciden = (tokenRecibido, tokenEsperado) => {
  if (!tokenRecibido || !tokenEsperado) return false;

  const recibido = Buffer.from(String(tokenRecibido));
  const esperado = Buffer.from(String(tokenEsperado));

  return (
    recibido.length === esperado.length &&
    crypto.timingSafeEqual(recibido, esperado)
  );
};

const validarTokenInterno = (req, res, next) => {
  const tokenEsperado = String(process.env.ABS_SYNC_TOKEN || "").trim();

  if (!tokenEsperado) {
    console.error(
      "Integracion RVE -> ABS deshabilitada: ABS_SYNC_TOKEN no esta configurado.",
    );
    return res.status(503).json({
      ok: false,
      encontrado: false,
      message: "Integracion interna no configurada.",
    });
  }

  if (!tokensCoinciden(req.get("x-internal-token"), tokenEsperado)) {
    return res.status(401).json({
      ok: false,
      encontrado: false,
      message: "Token interno invalido.",
    });
  }

  return next();
};

router.use(validarTokenInterno);

router.get("/usuarios/por-cedula/:cedula", async (req, res) => {
  const cedula = String(req.params.cedula || "").trim();

  if (!cedula) {
    return res.status(400).json({
      ok: false,
      encontrado: false,
      message: "cedula es obligatoria.",
    });
  }

  try {
    const usuarios = await Usuario.findAll({
      where: sequelizeWhere(fn("BTRIM", col("cedula")), cedula),
      attributes: [
        "id",
        "cedula",
        "nombre",
        "email",
        "usuario",
        "fechaIngreso",
        "fechaSalida",
        "numeroCuenta",
        "direccion",
        "telefono",
        "activo",
      ],
      limit: 2,
      order: [["id", "ASC"]],
    });

    if (usuarios.length === 0) {
      return res.json({
        ok: true,
        encontrado: false,
        cedula,
        usuario: null,
        message: "No existe un usuario ABS con la cedula indicada.",
      });
    }

    if (usuarios.length > 1) {
      return res.status(409).json({
        ok: false,
        encontrado: false,
        cedula,
        message: "Existe mas de un usuario ABS con la cedula indicada.",
      });
    }

    const datos =
      typeof usuarios[0].get === "function"
        ? usuarios[0].get({ plain: true })
        : usuarios[0];

    return res.json({
      ok: true,
      encontrado: true,
      cedula,
      usuario: datos,
    });
  } catch (error) {
    console.error("Error consultando usuario ABS para RVE:", error);
    return res.status(500).json({
      ok: false,
      encontrado: false,
      message: "No se pudo consultar el usuario en ABS.",
    });
  }
});

module.exports = router;
