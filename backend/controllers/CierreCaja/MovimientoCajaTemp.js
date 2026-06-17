// controllers/movimientoCajaTemp.controller.js

const MovimientoCajaTemp = require("../../models/CierreCaja/MovimientoCajaTemp");
const CierreCaja = require("../../models/CierreCaja/CierreCaja");
const UsuarioAgencia = require("../../models/UsuarioAgencia");
const { Op } = require("sequelize");

const obtenerFechaEcuador = (fecha = new Date()) =>
  fecha.toLocaleDateString("en-CA", { timeZone: "America/Guayaquil" });

const esFechaISOValida = (fecha) =>
  typeof fecha === "string" && /^\d{4}-\d{2}-\d{2}$/.test(fecha);

const redondearDosDecimales = (valor) =>
  Number((Number(valor) || 0).toFixed(2));

const resolverUsuarioAgenciaId = async (req) => {
  if (req.user?.usuarioAgenciaId) return req.user.usuarioAgenciaId;

  if (!req.user?.id || !req.user?.agenciaId) return null;

  const relacion = await UsuarioAgencia.findOne({
    where: {
      usuarioId: req.user.id,
      agenciaId: req.user.agenciaId,
      activo: true,
    },
    attributes: ["id"],
  });

  return relacion?.id || null;
};

const crearMovimientoTemp = async (req, res) => {
  try {
    const usuarioAgenciaId = await resolverUsuarioAgenciaId(req);
    if (!usuarioAgenciaId) {
      return res.status(400).json({
        ok: false,
        message: "Usuario no identificado",
      }); 
    } 

    const fechaMovimiento = esFechaISOValida(req.body?.fecha)
      ? req.body.fecha
      : obtenerFechaEcuador();

    const cierreExistente = await CierreCaja.findOne({
      where: {
        usuarioId: req.user.id,
        fecha: fechaMovimiento,
        estadoCierre: { [Op.in]: ["CERRADO", "REABIERTO"] },
      },
    });

    if (cierreExistente) {
      return res.status(409).json({
        ok: false,
        message: "La caja de la fecha seleccionada ya fue cerrada para este usuario",
      });
    }

    const { responsable, detalle, valor, formaPago, recibo, entidad, observacion } = req.body;

    if (!detalle?.trim() && !observacion?.trim()) {
      return res.status(400).json({
        ok: false,
        message: "Detalle requerido",
      });
    }

    if (!formaPago?.trim() && !observacion?.trim()) {
      return res.status(400).json({
        ok: false,
        message: "Debe seleccionar forma de pago o escribir una observación",
      });
    }

    if (!observacion?.trim()) {
      if (!valor || isNaN(valor) || Number(valor) <= 0) {
        return res.status(400).json({
          ok: false,
          message: "Valor inválido",
        });
      }
    }

    const nuevo = await MovimientoCajaTemp.create({
      usuarioAgenciaId,
      responsable,
      detalle: detalle?.trim() || null,
      valor: redondearDosDecimales(valor),
      formaPago: formaPago?.trim() || null,
      recibo,
      entidad: entidad?.trim() || null,
      observacion,
      estado: "ACTIVO",
    });

    return res.json({
      ok: true,
      data: nuevo,
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      ok: false,
      message: "Error al guardar movimiento temporal",
    });
  }
};

const obtenerMovimientosTemp = async (req, res) => {
  try {
    const usuarioAgenciaId = await resolverUsuarioAgenciaId(req);
    if (!usuarioAgenciaId) {
      return res.status(400).json({
        ok: false,
        message: "Usuario no identificado",
      });
    }

    const movimientos = await MovimientoCajaTemp.findAll({
      where: {
        usuarioAgenciaId,
        estado: "ACTIVO", 
      },
      order: [["id", "ASC"]],
    });

    return res.json({
      ok: true,
      data: movimientos,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      ok: false,
      message: "Error al obtener movimientos",
    });
  }
};

const eliminarMovimientoTemp = async (req, res) => {
  try {
    const { id } = req.params;
    const usuarioAgenciaId = await resolverUsuarioAgenciaId(req);

    if (!usuarioAgenciaId) {
      return res.status(400).json({
        ok: false,
        message: "Usuario no identificado",
      });
    }

    const eliminado = await MovimientoCajaTemp.destroy({
      where: { id, usuarioAgenciaId },
    });

    if (!eliminado) {
      return res.status(404).json({
        ok: false,
        message: "Movimiento no encontrado",
      });
    }

    return res.json({
      ok: true,
      message: "Movimiento eliminado",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      ok: false,
      message: "Error al eliminar",
    });
  }
};

// ============================
// 🧹 Limpiar movimientos (al cerrar)
// ============================
const limpiarMovimientosTemp = async (usuarioAgenciaId, transaction = null) => {
  return await MovimientoCajaTemp.update(
    { estado: "CERRADO" },
    {
      where: {
        usuarioAgenciaId,
        estado: "ACTIVO",
      },
      transaction,
    },
  );
};

module.exports = {
  crearMovimientoTemp,
  obtenerMovimientosTemp,
  eliminarMovimientoTemp,
  limpiarMovimientosTemp,
};
