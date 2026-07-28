const express = require("express");
const { col, fn, where: sequelizeWhere } = require("sequelize");

const { sequelize } = require("../config/db");
const { authenticate, requirePermission } = require("../middleware/authMiddleware");
const Usuario = require("../models/Usuario");
const {
  consultarUsuarioAbsPorCedula,
} = require("../services/absUsuariosService");
const {
  registrarNotificacionSalida,
  registrarNotificacionSegura,
} = require("../services/notificacionesPersonalService");

const router = express.Router();

router.use(authenticate, requirePermission("Administracion"));

const buscarUsuariosRvePorCedula = (cedula) =>
  Usuario.findAll({
    where: sequelizeWhere(fn("BTRIM", col("cedula")), cedula),
    attributes: [
      "id",
      "nombre",
      "cedula",
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

const construirResumenUsuario = (usuario) => ({
  id: usuario.id,
  nombre: usuario.nombre || null,
  cedula: usuario.cedula || null,
  email: usuario.email || null,
  usuario: usuario.usuario || null,
  fechaIngreso: usuario.fechaIngreso || null,
  fechaSalida: usuario.fechaSalida || null,
  numeroCuenta: usuario.numeroCuenta || null,
  direccion: usuario.direccion || null,
  telefono: usuario.telefono || null,
  activo: usuario.activo !== false,
});

const emitirActualizacionNovedadesPersonal = (req) => {
  const io = req.app.get("io");
  if (io) io.emit("novedades-personal:actualizar");
};

const validarCedula = (req, res) => {
  const cedula = String(req.params.cedula || "").trim();
  if (!cedula) {
    res.status(400).json({
      ok: false,
      encontrado: false,
      message: "La cedula es obligatoria.",
    });
    return null;
  }

  return cedula;
};

const responderErrorConsulta = (res, error) => {
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
};

router.get("/por-cedula/:cedula", async (req, res) => {
  const cedula = validarCedula(req, res);
  if (!cedula) return undefined;

  try {
    const usuariosLocales = await buscarUsuariosRvePorCedula(cedula);

    if (usuariosLocales.length > 1) {
      return res.status(409).json({
        ok: false,
        encontrado: false,
        code: "CEDULA_DUPLICADA_RVE",
        message: "Existe mas de un usuario RVE con esta cedula.",
      });
    }

    const resultado = await consultarUsuarioAbsPorCedula(cedula);
    const usuarioRve = usuariosLocales[0] || null;

    return res.json({
      ...resultado,
      existeEnRve: Boolean(usuarioRve),
      vinculadoPorCedula: Boolean(usuarioRve && resultado?.encontrado),
      usuarioAbs: resultado?.usuario || null,
      usuarioRve: usuarioRve
        ? construirResumenUsuario(usuarioRve)
        : null,
    });
  } catch (error) {
    return responderErrorConsulta(res, error);
  }
});

router.patch("/por-cedula/:cedula", async (req, res) => {
  const cedula = validarCedula(req, res);
  if (!cedula) return undefined;

  try {
    const usuariosLocales = await buscarUsuariosRvePorCedula(cedula);

    if (usuariosLocales.length === 0) {
      return res.status(404).json({
        ok: false,
        actualizado: false,
        code: "USUARIO_NO_EXISTE_RVE",
        message: "El usuario todavía no existe en RVE.",
      });
    }

    if (usuariosLocales.length > 1) {
      return res.status(409).json({
        ok: false,
        actualizado: false,
        code: "CEDULA_DUPLICADA_RVE",
        message: "Existe mas de un usuario RVE con esta cedula.",
      });
    }

    const resultado = await consultarUsuarioAbsPorCedula(cedula);
    if (!resultado?.encontrado || !resultado?.usuario) {
      return res.status(404).json({
        ok: false,
        actualizado: false,
        code: "USUARIO_NO_EXISTE_ABS",
        message: "No existe un usuario ABS con esta cedula.",
      });
    }

    const usuario = usuariosLocales[0];
    const usuarioAbs = resultado.usuario;
    const fechaSalidaAnterior = usuario.fechaSalida || null;
    const camposActualizados = [];
    const asignarSiTieneValor = (campo) => {
      const valor = usuarioAbs[campo];
      if (valor === null || valor === undefined || String(valor).trim() === "") {
        return;
      }

      if (String(usuario[campo] ?? "") !== String(valor)) {
        usuario[campo] = valor;
        camposActualizados.push(campo);
      }
    };

    ["nombre", "fechaIngreso", "numeroCuenta", "direccion", "telefono"].forEach(
      asignarSiTieneValor,
    );

    const fechaSalidaNueva = usuarioAbs.fechaSalida || null;
    if (fechaSalidaAnterior !== fechaSalidaNueva) {
      usuario.fechaSalida = fechaSalidaNueva;
      usuario.fechaSalidaRegistradaAt = fechaSalidaNueva ? new Date() : null;
      camposActualizados.push("fechaSalida");
    }

    if (camposActualizados.length > 0) {
      await sequelize.transaction(async (transaction) => {
        await usuario.save({ transaction });
      });
    }

    if (fechaSalidaAnterior !== fechaSalidaNueva) {
      if (usuario.fechaSalida) {
        await registrarNotificacionSegura(
          registrarNotificacionSalida(usuario, {
            origen: "ABS_USUARIOS",
          }),
          `salida ABS del usuario ${usuario.id}`,
        );
      }
      emitirActualizacionNovedadesPersonal(req);
    }

    return res.json({
      ok: true,
      actualizado: camposActualizados.length > 0,
      vinculadoPorCedula: true,
      cedula,
      camposActualizados,
      usuarioRve: construirResumenUsuario(usuario),
      preservado: [
        "id",
        "email",
        "usuario",
        "password",
        "roles",
        "agencias",
        "rolPagoId",
        "activo",
      ],
    });
  } catch (error) {
    return responderErrorConsulta(res, error);
  }
});

module.exports = router;
