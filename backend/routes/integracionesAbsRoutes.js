const crypto = require("crypto");
const express = require("express");

const { sequelize } = require("../config/db");
const Usuario = require("../models/Usuario");
const UsuarioAgencia = require("../models/UsuarioAgencia");

const router = express.Router();

const emitirActualizacionNovedadesPersonal = (req) => {
  const io = req.app.get("io");
  if (io) io.emit("novedades-personal:actualizar");
};

const tieneFechaISOValida = (fecha) => {
  if (typeof fecha !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return false;
  }

  const [year, month, day] = fecha.split("-").map(Number);
  const fechaUTC = new Date(Date.UTC(year, month - 1, day));

  return (
    fechaUTC.getUTCFullYear() === year &&
    fechaUTC.getUTCMonth() === month - 1 &&
    fechaUTC.getUTCDate() === day
  );
};

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
  const tokenEsperado = String(process.env.RVE_SYNC_TOKEN || "").trim();

  if (!tokenEsperado) {
    console.error(
      "Integracion ABS -> RVE deshabilitada: RVE_SYNC_TOKEN no esta configurado.",
    );
    return res.status(503).json({
      ok: false,
      sincronizado: false,
      message: "Integracion interna no configurada.",
    });
  }

  if (!tokensCoinciden(req.get("x-internal-token"), tokenEsperado)) {
    return res.status(401).json({
      ok: false,
      sincronizado: false,
      message: "Token interno invalido.",
    });
  }

  return next();
};

router.use(validarTokenInterno);

router.patch("/usuarios/salida", async (req, res) => {
  const cedula = typeof req.body?.cedula === "string"
    ? req.body.cedula.trim()
    : "";
  const incluyeFechaSalida = Object.prototype.hasOwnProperty.call(
    req.body || {},
    "fechaSalida",
  );
  const fechaSalida = req.body?.fechaSalida;
  const desactivar = req.body?.desactivar ?? false;
  const origen = typeof req.body?.origen === "string"
    ? req.body.origen.trim() || null
    : null;

  if (!cedula) {
    return res.status(400).json({
      ok: false,
      sincronizado: false,
      message: "cedula es obligatoria.",
    });
  }

  if (
    !incluyeFechaSalida ||
    (fechaSalida !== null && !tieneFechaISOValida(fechaSalida))
  ) {
    return res.status(400).json({
      ok: false,
      sincronizado: false,
      message: "fechaSalida debe ser null o tener formato YYYY-MM-DD.",
    });
  }

  if (typeof desactivar !== "boolean") {
    return res.status(400).json({
      ok: false,
      sincronizado: false,
      message: "desactivar debe ser booleano.",
    });
  }

  try {
    const usuarios = await Usuario.findAll({
      where: { cedula },
      limit: 2,
      order: [["id", "ASC"]],
    });

    if (usuarios.length === 0) {
      return res.json({
        ok: true,
        sincronizado: false,
        cedula,
        message: "No existe un usuario RVE con la cedula indicada.",
      });
    }

    if (usuarios.length > 1) {
      return res.status(409).json({
        ok: false,
        sincronizado: false,
        cedula,
        message: "Existe mas de un usuario RVE con la cedula indicada.",
      });
    }

    const usuario = usuarios[0];
    const fechaAnterior = usuario.fechaSalida || null;
    const activoAnterior = usuario.activo;
    const cambioFechaSalida = fechaAnterior !== fechaSalida;

    await sequelize.transaction(async (transaction) => {
      usuario.fechaSalida = fechaSalida;

      if (
        cambioFechaSalida &&
        Object.prototype.hasOwnProperty.call(
          Usuario.rawAttributes || {},
          "fechaSalidaRegistradaAt",
        )
      ) {
        usuario.fechaSalidaRegistradaAt = fechaSalida ? new Date() : null;
      }

      if (desactivar) {
        usuario.activo = false;
      }

      await usuario.save({ transaction });

      if (desactivar) {
        await UsuarioAgencia.update(
          { activo: false },
          {
            where: { usuarioId: usuario.id, activo: true },
            transaction,
          },
        );
      }
    });

    if (cambioFechaSalida) {
      emitirActualizacionNovedadesPersonal(req);
    }

    return res.json({
      ok: true,
      sincronizado: true,
      usuarioId: usuario.id,
      cedula,
      fechaSalida: usuario.fechaSalida,
      desactivado: usuario.activo === false,
      actualizado:
        fechaAnterior !== usuario.fechaSalida ||
        (desactivar && activoAnterior !== false),
      notificacionGenerada: cambioFechaSalida && Boolean(usuario.fechaSalida),
      origen,
    });
  } catch (error) {
    console.error("Error sincronizando salida de ABS hacia RVE:", error);
    return res.status(500).json({
      ok: false,
      sincronizado: false,
      message: "No se pudo sincronizar la salida en RVE.",
    });
  }
});

module.exports = router;
